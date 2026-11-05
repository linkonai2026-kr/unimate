// 강원대 홈페이지의 삼척캠퍼스 금주의 식단(5공학관식당)을 한국 날짜 기준으로 늘 새로 읽어 오는 파서와 fetch(저장본 없음)
import * as cheerio from 'cheerio'
import { t, type Lang } from '../i18n'
import { addDays, fetchHtml, kstDay, type Fetcher, type KstDay } from './memo'

export const MENU_URL = 'https://www.kangwon.ac.kr/ko/extn/337/wkmenu-mngr/list.do?campusCd=2'
export type Meal = '아침' | '점심' | '저녁'
export interface MenuWeek {
  restaurant: string
  days: string[]
  /** meal은 보통 아침·점심·저녁이지만, 사이트가 다른 이름(예: 중식)을 써도 그대로 둔다 */
  corners: { name: string; price: string | null; meals: { meal: string; byDay: string[][] }[] }[]
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

export function parseMenu(html: string): MenuWeek {
  const $ = cheerio.load(html)
  const restaurant = clean($('.sub-intro-title').first().text())
  const days = $('table.meal').first().find('thead th').slice(1).map((_, th) => clean($(th).text())).get()
  const corners = new Map<string, MenuWeek['corners'][number]>()
  $('.meal-container').each((_, box) => {
    const head = clean($(box).find('.meal-title-area').first().text())
    if (!head) return
    const m = head.match(/^(.*?)\s*\(([^)]*원)\)\s*$/)
    const name = m ? m[1] : head
    const corner = corners.get(name) ?? { name, price: m ? m[2] : null, meals: [] }
    $(box).find('tbody tr').each((_, tr) => {
      const meal = clean($(tr).find('td').first().text())
      if (!meal) return
      const byDay = $(tr).find('td.menu-cell').toArray().map(td =>
        $(td).find('.menu-text').toArray().flatMap(el => $(el).text().split('\n').map(clean)).filter(Boolean))
      corner.meals.push({ meal, byDay })
    })
    corners.set(name, corner)
  })
  return { restaurant, days, corners: [...corners.values()] }
}

/**
 * 식단을 볼 주의 기준 날짜(한국 시간). 학교 사이트는 targetDate가 든 일~토 한 주를 보여 준다.
 * 평일·일요일은 오늘 그대로(일요일이면 사이트가 곧 올 월~금을 준다), 토요일은 이번 주 식당이 끝났으니 하루 뒤(다음 주)
 */
export function menuTargetDay(now: Date | number = Date.now()): KstDay {
  const today = kstDay(now)
  return today.dow === 6 ? addDays(today, 1) : today
}

export const menuUrl = (day: KstDay) => `${MENU_URL}&targetDate=${day.iso.replace(/-/g, '')}`

export type MenuResult = { week: MenuWeek; source: 'live' } | { week: null; source: 'error' }

const RETRY_DELAY_MS = 400

/**
 * 학교 사이트에서 이번 주 식단을 늘 새로 받는다(저장본·옛 날짜를 보여 주지 않는다).
 * 실패하거나 빈 표면 잠깐 쉬고 한 번 더 시도하고(시도마다 8초 제한), 그래도 안 되면 error
 */
export async function getMenu(get: Fetcher = fetchHtml, now: Date | number = Date.now(), retryDelayMs = RETRY_DELAY_MS): Promise<MenuResult> {
  const url = menuUrl(menuTargetDay(now))
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, retryDelayMs))
    try {
      const week = parseMenu(await get(url))
      if (week.days.length > 0 && week.corners.some(c => c.meals.length > 0)) return { week, source: 'live' }
      console.warn('[getMenu] empty table')
    } catch (e) {
      console.warn('[getMenu]', e instanceof Error ? e.message : e)
    }
  }
  return { week: null, source: 'error' }
}

/** 그날 실제로 나오는 메뉴(없거나 "운영안함"이면 빈 목록) */
export function servedOn(byDay: string[][], day: number): string[] {
  const items = day >= 0 ? byDay[day] ?? [] : []
  return items.length === 0 || items.join('').replace(/\s/g, '') === '운영안함' ? [] : items
}

/** 오늘(한국 시간) 열의 번호. 이번 주 표에 없으면 -1. "10.19(월)"·"01.05(월)" 모두 읽는다 */
export function todayIndex(days: string[], now: Date | number = Date.now()): number {
  const { m: month, d: date } = kstDay(now)
  return days.findIndex(d => {
    const m = /^\s*(\d{1,2})\s*[./]\s*(\d{1,2})/.exec(d)
    return !!m && Number(m[1]) === month && Number(m[2]) === date
  })
}

/** 지금 시각(한국)에 맞는 끼니: 10시 전 아침, 15시 전 점심, 그 뒤 저녁 */
export function currentMeal(now: Date | number = Date.now()): Meal {
  const h = new Date((typeof now === 'number' ? now : now.getTime()) + 9 * 3600_000).getUTCHours()
  return h < 10 ? '아침' : h < 15 ? '점심' : '저녁'
}

const MEAL_KEY = { 아침: 'breakfast', 점심: 'lunch', 저녁: 'dinner' } as const
/** 아침·점심·저녁은 사용자 언어로, 모르는 구분 이름은 원문 그대로 */
export const mealLabel = (meal: string, lang: Lang) => (Object.hasOwn(MEAL_KEY, meal) ? t(lang, MEAL_KEY[meal as Meal]) : meal)

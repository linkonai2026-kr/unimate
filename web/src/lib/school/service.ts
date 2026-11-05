// 공지 요약·식단 번역을 사용자 언어로 만들어 캐시하는 서버 도우미(한국 날짜 기준, 실패해도 화면에 예외를 올리지 않는다)
import 'server-only'
import { summarizeNotice, translateList, type Apply, type Summary } from '../ai'
import { has } from '../env'
import type { Lang } from '../i18n'
import { getMenu, menuTargetDay, type MenuWeek } from './menu'
import { addDays, createMemo, kstDay } from './memo'
import { dDay, getNoticeHtml, getNotices, parseNoticeBody, parseNoticeDetail, postedToday, snapshotNotices, type Notice, type NoticeBoard, type NoticeDetail } from './notices'

// ponytail: 프로세스 메모리 캐시(10분). 서버리스 인스턴스마다 따로 생기며, 많아지면 DB 캐시로 옮긴다
const g = globalThis as { __uniSchoolMemo?: ReturnType<typeof createMemo> }
const memo = (g.__uniSchoolMemo ??= createMemo(10 * 60_000))

/** 캐시 키용 짧은 해시(목록 내용이 바뀌면 키도 바뀌게) */
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** 목록 번역. 실패해서 원문 그대로 돌아온 결과는 캐시하지 않는다 */
function translated(kind: string, items: string[], lang: Lang): Promise<string[]> {
  if (lang === 'ko' || !has.ai || items.length === 0) return Promise.resolve(items)
  return memo(`${kind}:${lang}:${items.length}:${hash(items.join('\n'))}`, () => translateList(items, lang),
    out => out.length === items.length && out.some((x, i) => x !== items[i]))
    .then(out => (out.length === items.length ? out : items))
    .catch(() => items)
}

type Detail = NoticeDetail & { body: string }
const NO_DETAIL: Detail = { text: '', images: 0, files: [], body: '' }

/** 상세 페이지에서 뽑은 정보(HTML 전체 대신 뽑은 글자만 캐시). 받지 못했으면 캐시하지 않는다 */
function detailOf(n: Notice): Promise<Detail> {
  return memo(`detail:${n.board}:${n.id}`, async () => {
    const html = await getNoticeHtml(n.board, n.id)
    return html ? { ...parseNoticeDetail(html), body: parseNoticeBody(html) } : NO_DETAIL
  }, d => d !== NO_DETAIL).catch(() => NO_DETAIL)
}

/** 학교 사이트의 실제 정보(제목·부서·날짜·본문 앞부분·첨부)에, AI 키가 있을 때만 3줄 요약·마감일·번역 제목을 덧붙인다 */
/** isToday: 오늘(한국) 올라온 글, dday: 마감까지 "D-3"(한국 날짜 기준, 지났거나 모르면 null) */
/** apply: AI가 뽑은 신청 방법(제출처·신청 주소·준비 서류), 없으면 null */
export type NoticeCard = Notice & { titleTr: string; excerpt: string; images: number; files: string[]; bullets: string[]; deadline: string | null; isToday: boolean; dday: string | null; apply: Apply | null }

const bare = (n: Notice): NoticeCard => ({ ...n, titleTr: n.title, excerpt: '', images: 0, files: [], bullets: [], deadline: null, isToday: postedToday(n.date), dday: null, apply: null })

/** 공지 목록: 한국 날짜를 키에 넣어 자정이 지나면 새로 받는다(10분 캐시). 사이트가 안 될 때의 스냅샷은 캐시하지 않는다 */
function noticeList(board: NoticeBoard, limit: number) {
  return memo(`list:${kstDay().iso}:${board}:${limit}`, () => getNotices(board, limit), r => r.source === 'live')
}

export async function noticeCards(board: NoticeBoard, lang: Lang, limit = 3): Promise<{ items: NoticeCard[]; source: 'live' | 'snapshot' }> {
  try {
    const { items, source } = await noticeList(board, limit)
    // 목록을 못 받았으면(스냅샷) 상세도 받을 수 없으니 기다리지 않는다
    const [titles, details] = await Promise.all([
      translated('titles', items.map(n => n.title), lang),
      Promise.all(items.map(n => (source === 'live' ? detailOf(n) : NO_DETAIL))),
    ])
    const cards = await Promise.all(items.map(async (n, i): Promise<NoticeCard> => {
      const d = details[i]
      const s: Summary | null = has.ai && d.body
        ? await memo(`sum:${n.board}:${n.id}:${lang}`, () => summarizeNotice(n.title, d.body, lang)).catch(() => null)
        : null
      const deadline = s?.deadline ?? null
      return { ...n, titleTr: titles[i] || n.title, excerpt: d.text.slice(0, 160), images: d.images, files: d.files, bullets: s?.bullets ?? [], deadline, isToday: postedToday(n.date), dday: deadline ? dDay(deadline) : null, apply: s?.apply ?? null }
    }))
    return { items: cards, source }
  } catch (e) {
    console.warn('[noticeCards]', board, e instanceof Error ? e.message : e)
    return { items: snapshotNotices(board, limit).map(bare), source: 'snapshot' }
  }
}

export type MenuView = MenuWeek & { tr: Record<string, string> }
/** live: 방금 학교 사이트에서 받음, cached: 사이트가 응답하지 않아 같은 주에 마지막으로 받은 식단(at: 받은 시각) */
export type MenuResultView = { week: MenuView; source: 'live' } | { week: MenuView; source: 'cached'; at: number } | { week: null; source: 'error' }

/** 식단 주의 기준(학교 사이트는 일~토 한 주를 보여 준다): 그 주 일요일 날짜 */
const weekKey = (now = Date.now()) => {
  const day = menuTargetDay(now)
  return addDays(day, -day.dow).iso
}

// 마지막으로 받은 식단(같은 주일 때만 쓴다: 지난주 식단은 보여 주지 않는다). 서버가 재시작하면 사라진다
const lastMenu = globalThis as { __uniLastMenu?: { week: MenuWeek; weekKey: string; at: number } }

/**
 * 메뉴 이름을 사용자 언어로 번역한 표(원문 → 번역). 식단은 늘 학교 사이트에서 새로 받는다.
 * 같은 주를 동시에 여러 명이 열면 요청 하나를 같이 쓰고(keep=false라 저장은 하지 않는다), 번역만 내용 해시로 캐시한다.
 * 사이트가 응답하지 않으면 같은 주에 마지막으로 받은 식단을 받은 시각과 함께 보여 주고, 그것도 없으면 error
 */
export async function menuView(lang: Lang, now = Date.now()): Promise<MenuResultView> {
  const r = await memo(`menu-fetch:${menuTargetDay(now).iso}`, () => getMenu(), () => false).catch(() => ({ week: null, source: 'error' as const }))
  let week: MenuWeek
  let at: number | null = null
  if (r.week) {
    week = r.week
    lastMenu.__uniLastMenu = { week, weekKey: weekKey(now), at: now }
  } else {
    const saved = lastMenu.__uniLastMenu
    if (!saved || saved.weekKey !== weekKey(now)) return { week: null, source: 'error' }
    week = saved.week
    at = saved.at
  }
  const names = [...new Set(week.corners.flatMap(c => [c.name, ...c.meals.flatMap(m => m.byDay.flat())]))]
  const out = await translated('menu', names, lang)
  const tr = Object.fromEntries(names.map((n, k) => [n, out[k] || n]))
  return at == null ? { week: { ...week, tr }, source: 'live' } : { week: { ...week, tr }, source: 'cached', at }
}

// 두 사람의 공강이 겹치는 시간을 계산하고 친구 추천 순위를 매긴다(공강 겹침, 같은 수업), 아이디 정리
import { dayName, type Lang } from '../i18n'
import type { NewCourse } from '../store/types'
import type { Profile } from '../types'
import { DAY_END, DAYS, SLOT_START, SLOTS_PER_DAY, busyMask, fmtMin } from './slots'

/** 공강으로 세는 칸: 요일마다 09–18시(저녁 칸은 빼서 추천이 부풀지 않게) */
const DAY_SLOTS = (DAY_END - SLOT_START) / 30
const ALL = Array.from({ length: DAYS }, (_, d) => ((1n << BigInt(DAY_SLOTS)) - 1n) << BigInt(d * SLOTS_PER_DAY)).reduce((a, b) => a | b, 0n)
const LIMIT = 10
export type Range = { day: number; start: number; end: number }
type Other = { profile: Profile; courses: NewCourse[] }

/** 주소(%인코딩 포함)·검색어로 받은 아이디를 가입 규칙(영문 소문자·숫자 3~20자)에 맞춰 정리. 맞지 않으면 null */
export function cleanHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  try {
    s = decodeURIComponent(s)
  } catch {
    return null
  }
  s = s.trim().replace(/^@/, '').toLowerCase()
  return /^[a-z0-9]{3,20}$/.test(s) ? s : null
}

export const freeMask = (busy: bigint) => ALL & ~busy

/** 둘 다 비어 있는 칸을 요일별 연속 구간으로 */
export function overlapRanges(a: bigint, b: bigint): Range[] {
  const both = a & b
  const out: Range[] = []
  for (let d = 0; d < DAYS; d++) {
    let open = -1
    for (let s = 0; s <= SLOTS_PER_DAY; s++) {
      const on = s < SLOTS_PER_DAY && ((both >> BigInt(d * SLOTS_PER_DAY + s)) & 1n) === 1n
      if (on && open < 0) open = s
      if (!on && open >= 0) {
        out.push({ day: d, start: SLOT_START + open * 30, end: SLOT_START + s * 30 })
        open = -1
      }
    }
  }
  return out
}

const candidates = (me: Profile, others: Other[], friendIds: Set<string>) => others.filter(o => o.profile.id !== me.id && !friendIds.has(o.profile.id))

/** 공강이 많이 겹치는 사람(나·이미 친구·시간표 없는 사람 제외), 겹치는 시간이 긴 순 */
export function rankMatches(me: Profile, myCourses: NewCourse[], others: Other[], friendIds: Set<string>) {
  const mine = freeMask(busyMask(myCourses))
  return candidates(me, others, friendIds)
    .filter(o => o.courses.length > 0)
    .map(o => {
      const ranges = overlapRanges(mine, freeMask(busyMask(o.courses))).sort((x, y) => y.end - y.start - (x.end - x.start))
      return { profile: o.profile, ranges, minutes: ranges.reduce((n, r) => n + r.end - r.start, 0) }
    })
    .filter(m => m.minutes > 0)
    .sort((x, y) => y.minutes - x.minutes)
    .slice(0, LIMIT)
}

/** 같은 강좌로 볼 열쇠: 강좌 목록 코드가 있으면 코드, 없으면 이름·요일·시작(같은 분반) */
const classKey = (c: NewCourse) => (c.code ? `c:${c.code}` : `n:${c.name}|${c.day}|${c.start}`)

/** 나와 같은 수업을 듣는 사람(나·이미 친구 제외), 겹치는 과목이 많은 순 */
export function sameClassMatches(me: Profile, myCourses: NewCourse[], others: Other[], friendIds: Set<string>) {
  return candidates(me, others, friendIds)
    .map(o => {
      const theirs = new Set(o.courses.map(classKey))
      return { profile: o.profile, shared: [...new Set(myCourses.filter(c => theirs.has(classKey(c))).map(c => c.name))] }
    })
    .filter(m => m.shared.length > 0)
    .sort((x, y) => y.shared.length - x.shared.length)
    .slice(0, LIMIT)
}

export const formatRange = (r: Range, lang: Lang) => `${dayName(r.day, lang)} ${fmtMin(r.start)}–${fmtMin(r.end)}`

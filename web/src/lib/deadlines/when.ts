// 공지 마감 글자("11/17 18:00", "2026.11.17", "11월 17일 오후 6시", "11/10~11/17")를 한국 시각으로 읽는다
import { kstDay } from '../school/memo'

const KST_OFFSET = 9 * 3600_000
const DAY_MS = 86_400_000
/** 연도 없이 적힌 날짜가 오늘보다 이만큼 넘게 지났으면 다음 해로 본다(12월에 본 "1/5" 같은 경우) */
const PAST_GRACE_DAYS = 60

/** 한국 날짜와 시각. 시각이 적혀 있지 않으면 h·min은 null */
export interface Due { y: number; m: number; d: number; h: number | null; min: number | null }

const valid = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** 날짜 하나: [년(없으면 null), 월, 일, 글자에서 끝난 위치] */
type Hit = { y: number | null; m: number; d: number; end: number }

function dates(s: string): Hit[] {
  const out: Hit[] = []
  const take = (re: RegExp, pick: (m: RegExpExecArray) => [number | null, number, number]) => {
    for (const m of s.matchAll(re)) {
      const [y, mo, d] = pick(m)
      out.push({ y, m: mo, d, end: (m.index ?? 0) + m[0].length })
    }
  }
  take(/(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/g, m => [Number(m[1]), Number(m[2]), Number(m[3])])
  take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, m => [null, Number(m[1]), Number(m[2])])
  // "11/17", "11.17": 앞뒤에 숫자·점·빗금이 더 붙은 것(연도가 있는 날짜, 소수)은 위에서 읽었거나 날짜가 아니다
  take(/(?<![\d./-])(\d{1,2})\s*[/.]\s*(\d{1,2})(?![\d./-])/g, m => [null, Number(m[1]), Number(m[2])])
  return out.sort((a, b) => a.end - b.end)
}

/** 날짜 뒤에 적힌 시각: "18:00", "18시 30분", "오후 6시", "6 PM" */
function timeAfter(rest: string): [number, number] | null {
  const m = /^\D{0,12}?(오전|오후|AM|PM)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시\s*(?:(\d{1,2})\s*분)?)\s*(AM|PM)?/i.exec(rest)
  if (!m) return null
  let h = Number(m[2])
  const min = Number(m[3] ?? m[4] ?? 0)
  const ampm = (m[1] ?? m[5] ?? '').toUpperCase()
  if ((ampm === '오후' || ampm === 'PM') && h < 12) h += 12
  if ((ampm === '오전' || ampm === 'AM') && h === 12) h = 0
  return h <= 24 && min < 60 ? [h, min] : null
}

/** 마감 글자를 읽는다. 기간("A~B")이면 끝 날짜를 쓴다. 못 읽으면 null */
export function parseDue(s: string, now: Date | number = Date.now()): Due | null {
  const text = (s ?? '').trim()
  if (!text) return null
  const hits = dates(text)
  if (hits.length === 0) return null
  const hit = /[~〜–]/.test(text) ? hits[hits.length - 1] : hits[0]
  const today = kstDay(now)
  let y = hit.y ?? today.y
  if (hit.y == null) {
    const diff = (Date.UTC(y, hit.m - 1, hit.d) - Date.UTC(today.y, today.m - 1, today.d)) / DAY_MS
    if (diff < -PAST_GRACE_DAYS) y += 1
  }
  if (!valid(y, hit.m, hit.d)) return null
  const time = timeAfter(text.slice(hit.end))
  return { y, m: hit.m, d: hit.d, h: time?.[0] ?? null, min: time?.[1] ?? null }
}

/** 마감 순간(ms). 시각이 없으면 그날 23:59(한국) */
export const dueMs = (due: Due): number => Date.UTC(due.y, due.m - 1, due.d, due.h ?? 23, due.min ?? 59) - KST_OFFSET

/** 마감까지 남은 날 표시(한국 날짜 기준): "D-3", 오늘이면 "D-day", 지났거나 못 읽으면 null */
export function dDayOf(deadline: string, now: Date | number = Date.now()): string | null {
  const due = parseDue(deadline, now)
  if (!due) return null
  const today = kstDay(now)
  const diff = Math.round((Date.UTC(due.y, due.m - 1, due.d) - Date.UTC(today.y, today.m - 1, today.d)) / DAY_MS)
  if (!Number.isFinite(diff) || diff < 0) return null
  return diff === 0 ? 'D-day' : `D-${diff}`
}

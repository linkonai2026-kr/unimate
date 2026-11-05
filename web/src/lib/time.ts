// "3분 전" 같은 상대 시간을 사용자 언어로
import type { Lang } from './i18n'

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12], ['year', Infinity]]
const formatters = new Map<Lang, Intl.RelativeTimeFormat>()
const rtf = (lang: Lang) => {
  let f = formatters.get(lang)
  if (!f) formatters.set(lang, (f = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })))
  return f
}

export function timeAgo(ts: number, lang: Lang, now = Date.now()): string {
  if (!Number.isFinite(ts)) return ''
  // 시계 차이로 조금 미래인 시각은 "지금"으로
  let v = Math.min(0, ts - now) / 60_000
  if (Math.abs(v) < 1) return rtf(lang).format(0, 'second')
  for (const [unit, size] of STEPS) {
    // 반올림한 값이 단위를 넘으면(59.6분 → 60분) 다음 단위로
    if (Math.abs(Math.round(v)) < size) return rtf(lang).format(Math.round(v), unit)
    v /= size
  }
  return ''
}

/** 한 시간 안에 올라온 글인지("N" 표시) */
export const isNew = (ts: number, now = Date.now()) => now - ts < 3600_000

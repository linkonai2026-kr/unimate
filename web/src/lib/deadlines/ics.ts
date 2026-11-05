// 공지 마감을 휴대폰 기본 캘린더에 넣는 .ics(iCalendar) 파일 만들기: 마감 일정 + 하루 전·당일 알림
import { createHash } from 'node:crypto'
import { dueMs, type Due } from './when'

export interface IcsInput {
  title: string
  due: Due
  /** 알림에 보일 문구 */
  alarm: string
  /** 설명 칸: 제출처·준비 서류·원문 주소 등 */
  lines: string[]
  url?: string | null
  now?: number
}

/** 글자 값 이스케이프(RFC 5545 3.3.11) */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** 한 줄 75바이트 제한: 넘으면 줄을 접는다(한글은 3바이트라 글자 수가 아니라 바이트로 센다) */
export function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // 이어지는 줄은 앞의 공백 한 칸을 뺀다
    if (bytes + n > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const pad = (n: number) => String(n).padStart(2, '0')
const utc = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}
const ymd = (y: number, m: number, d: number) => `${y}${pad(m)}${pad(d)}`

/**
 * 시각이 있으면 마감 30분 전~마감 일정, 알림은 하루 전과 3시간 전.
 * 시각이 없으면 그날 종일 일정, 알림은 전날 9시와 당일 9시(종일 일정 시작 00:00 기준)
 */
export function buildIcs({ title, due, alarm, lines, url, now = Date.now() }: IcsInput): string {
  const uid = createHash('sha256').update(`${title}\u0000${due.y}-${due.m}-${due.d}\u0000${url ?? ''}`).digest('hex').slice(0, 24)
  const timed = due.h != null
  const end = dueMs(due)
  const next = new Date(Date.UTC(due.y, due.m - 1, due.d + 1))
  const when = timed
    ? [`DTSTART:${utc(end - 30 * 60_000)}`, `DTEND:${utc(end)}`]
    : [`DTSTART;VALUE=DATE:${ymd(due.y, due.m, due.d)}`, `DTEND;VALUE=DATE:${ymd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())}`]
  const triggers = timed ? ['-P1D', '-PT3H'] : ['-PT15H', 'PT9H']
  const desc = [...lines, url ?? ''].map(s => s.trim()).filter(Boolean).join('\n')
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unimate//Notice deadline//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@unimate`,
    `DTSTAMP:${utc(now)}`,
    ...when,
    `SUMMARY:${esc(title)}`,
    ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
    ...(url ? [`URL:${url}`] : []),
    ...triggers.flatMap(tr => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(alarm)}`, `TRIGGER:${tr}`, 'END:VALARM']),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return body.map(fold).join('\r\n') + '\r\n'
}

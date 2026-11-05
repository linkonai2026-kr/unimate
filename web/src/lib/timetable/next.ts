// 지금(한국 시간) 듣는 수업, 오늘 남은 다음 수업, 없으면 다음 수업 날의 첫 수업. 서버가 UTC여도 한국 시간으로 계산한다
import type { NewCourse } from '../store/types'

/** 한국은 서머타임이 없어 늘 UTC+9 */
const KST_OFFSET = 9 * 3600_000

/** inDays: 오늘이면 0, 내일이면 1 … */
type Picked<T> = { course: T; status: 'now' | 'next' | 'later'; inDays: number }

/** 한국 시간의 요일(월=0 … 일=6)과 자정부터 분 */
export function kstClock(now: Date = new Date()): { day: number; min: number } {
  const kst = new Date(now.getTime() + KST_OFFSET)
  return { day: (kst.getUTCDay() + 6) % 7, min: kst.getUTCHours() * 60 + kst.getUTCMinutes() }
}

export function nextClass<T extends Pick<NewCourse, 'name' | 'place' | 'day' | 'start' | 'end'>>(courses: T[], now: Date = new Date()): Picked<T> | null {
  const { day, min } = kstClock(now)
  const on = (d: number) => courses.filter(c => c.day === d).sort((a, b) => a.start - b.start)
  const today = on(day)
  const cur = today.find(c => c.start <= min && min < c.end)
  if (cur) return { course: cur, status: 'now', inDays: 0 }
  const nxt = today.find(c => c.start > min)
  if (nxt) return { course: nxt, status: 'next', inDays: 0 }
  // 7일 뒤(다음 주 같은 요일)까지 본다
  for (let inDays = 1; inDays <= 7; inDays++) {
    const first = on((day + inDays) % 7)[0]
    if (first) return { course: first, status: 'later', inDays }
  }
  return null
}

// 시간표를 30분 칸 비트마스크로 바꾸고, 캡처 인식 결과를 바로잡는 계산
import type { ParsedCourse } from '../ai'
import { cleanInput } from '../board/flow'
import type { NewCourse } from '../store/types'

export const SLOT_START = 540 // 09:00
/** 받을 수 있는 마지막 시각. 에타 시간표는 오후 8시 칸(20:00–21:00)까지 있어서 21시 */
export const SLOT_END = 1260 // 21:00
/** 평소 격자 끝·공강을 세는 끝(저녁 시간까지 공강으로 세면 추천이 부푼다) */
export const DAY_END = 1080 // 18:00
export const SLOTS_PER_DAY = (SLOT_END - SLOT_START) / 30 // 24
export const DAYS = 5
/** 과목명·강의실 최대 길이 */
export const NAME_MAX = 40
export const PLACE_MAX = 80

export const isDay = (d: unknown): d is NewCourse['day'] => Number.isInteger(d) && (d as number) >= 0 && (d as number) < DAYS

/** 격자 끝 시각: 평소 18시, 더 늦게 끝나는 수업이 있으면 그 시각을 올림한 정시(최대 21시) */
export function gridEnd(courses: { end: number }[]): number {
  let end = DAY_END
  for (const c of courses) if (Number.isFinite(c.end)) end = Math.max(end, Math.ceil(c.end / 60) * 60)
  return Math.min(SLOT_END, end)
}

/** "13:30"(또는 시간 입력칸의 "13:30:00") → 810. 형식이 틀리거나 범위를 벗어나면 NaN */
export function toMin(hhmm: unknown): number {
  if (typeof hhmm !== 'string') return NaN
  const m = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(hhmm.trim())
  if (!m || Number(m[1]) > 23) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

export const fmtMin = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** 수업이 있는 칸이 1인 120비트 마스크(요일*24 + 칸). 요일이 이상한 강의는 건너뛴다 */
export function busyMask(courses: Pick<NewCourse, 'day' | 'start' | 'end'>[]): bigint {
  let m = 0n
  for (const c of courses) {
    if (!isDay(c.day)) continue
    for (let t = Math.max(c.start, SLOT_START); t < Math.min(c.end, SLOT_END); t += 30)
      m |= 1n << BigInt(c.day * SLOTS_PER_DAY + Math.floor((t - SLOT_START) / 30))
  }
  return m
}

export type Warning = { code: 'empty' | 'pm' | 'clamp' | 'overlap' | 'invalid'; name?: string }

const overlaps = (a: Pick<NewCourse, 'day' | 'start' | 'end'>, b: Pick<NewCourse, 'day' | 'start' | 'end'>) => a.day === b.day && a.start < b.end && b.start < a.end
/** 제어 문자 제거·길이 자르기(이모지 반쪽 없이) */
const text = (v: unknown, max: number) => cleanInput(v, max)

/** 인식(또는 사용자가 고친) 목록을 저장할 수 있는 강의로 바꾼다. 버린 줄·보정한 줄·겹침은 경고로 알린다 */
export function normalizeParsed(list: ParsedCourse[]): { courses: NewCourse[]; warnings: Warning[] } {
  const courses: NewCourse[] = []
  const warnings: Warning[] = []
  for (const p of list) {
    const name = text(p?.name, NAME_MAX)
    let start = toMin(p?.start), end = toMin(p?.end)
    if (!name || !isDay(p.day) || Number.isNaN(start) || Number.isNaN(end)) {
      warnings.push({ code: 'invalid', name: name || undefined })
      continue
    }
    // 끝 시간만 12시간제로 온 경우(11:00–01:00) 끝에만 12시간을 더한다
    if (end < start && end < SLOT_START && end + 720 > start) {
      end += 720
      warnings.push({ code: 'pm', name })
    }
    // 에브리타임은 오후를 1~8로 적는다. 블록 전체가 09시 전에 끝나면 오후를 잘못 읽은 것으로 본다
    if (start >= 60 && end <= SLOT_START && start < end) {
      start += 720
      end += 720
      warnings.push({ code: 'pm', name })
    } else if (start < SLOT_START || end > SLOT_END) {
      warnings.push({ code: 'clamp', name })
    }
    start = Math.max(start, SLOT_START)
    end = Math.min(end, SLOT_END)
    if (end <= start) {
      warnings.push({ code: 'invalid', name })
      continue
    }
    courses.push({ name, place: text(p.place, PLACE_MAX), day: p.day, start, end })
  }
  for (let i = 0; i < courses.length; i++)
    for (let j = i + 1; j < courses.length; j++)
      if (overlaps(courses[i], courses[j])) warnings.push({ code: 'overlap', name: `${courses[i].name} · ${courses[j].name}` })
  if (courses.length === 0) warnings.push({ code: 'empty' })
  return { courses, warnings }
}

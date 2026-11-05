// 수업 찾기: 개설 강좌 목록(시드 + 사용자들이 캡처로 올린 강의) 필터와 시간 겹침 검사
import type { NewCourse } from '../store/types'

export type Slot = { day: number; start: number; end: number }
export interface CatalogCourse { code: string; name: string; prof: string; credit: number; type: 'major' | 'general'; place: string; slots: Slot[] }
export interface CatalogFilter { q?: string; type?: 'major' | 'general' | ''; credit?: number; day?: number; hideClash?: boolean }

/** 직접 넣은 일정의 코드 앞머리. 강좌 목록 코드와 겹치지 않고, 칸이 다시 만들어져도 색·선택이 유지되게 한다 */
export const CUSTOM_PREFIX = 'my-'
export const isCustomCode = (code?: string | null) => !!code && code.startsWith(CUSTOM_PREFIX)

/** 같은 요일에 시간이 겹치면 true(맞닿기만 하면 false) */
export const clash = (a: Slot[], b: Slot[]) => a.some(x => b.some(y => x.day === y.day && x.start < y.end && y.start < x.end))

export function filterCatalog(list: CatalogCourse[], f: CatalogFilter, mine: (Slot & { code?: string })[]): CatalogCourse[] {
  const q = f.q?.trim().toLowerCase()
  const added = new Set(mine.map(m => m.code).filter(Boolean))
  return list.filter(c =>
    (!q || `${c.name} ${c.prof} ${c.code}`.toLowerCase().includes(q)) &&
    (!f.type || c.type === f.type) &&
    (!f.credit || c.credit === f.credit) &&
    (f.day == null || c.slots.some(s => s.day === f.day)) &&
    (!f.hideClash || added.has(c.code) || !clash(c.slots, mine)))
}

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36)

/** 캡처로 올린 시간표 강의를 과목(이름·강의실) 단위로 묶어 목록에 보탠다(같은 칸은 한 번만). 학점은 주당 시간으로 짐작(1~3) */
export function catalogFromCourses(courses: Pick<NewCourse, 'name' | 'place' | 'day' | 'start' | 'end'>[]): CatalogCourse[] {
  const by = new Map<string, CatalogCourse>()
  for (const c of courses) {
    const key = `${c.name}|${c.place}`
    const item = by.get(key) ?? { code: `U${hash(key)}`, name: c.name, prof: '', credit: 0, type: 'major' as const, place: c.place, slots: [] }
    // 여러 사람이 같은 분반을 올리면 같은 칸이 겹쳐 들어오니 한 번만 담는다(학점 짐작도 부풀지 않게)
    if (!item.slots.some(s => s.day === c.day && s.start === c.start && s.end === c.end)) item.slots.push({ day: c.day, start: c.start, end: c.end })
    by.set(key, item)
  }
  return [...by.values()].map(c => ({ ...c, credit: Math.min(3, Math.max(1, Math.round(c.slots.reduce((n, s) => n + s.end - s.start, 0) / 60))) }))
}

// 시간표 화면용: 학기·시간표 고르기와 칸 묶기(과목 키 = 강좌 코드 또는 직접 일정 id)
import 'server-only'
import { getStore } from '../store'
import type { Course, Table } from '../types'
import { CURRENT_SEM, SEMS } from './sem'

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

/** ?t=시간표 id(내 것만), 없으면 ?sem=학기(목록에 있는 것만)의 기본 시간표 */
export async function resolveTable(userId: string, sp: { sem?: string | string[]; t?: string | string[] }): Promise<{ sem: string; tables: Table[]; table: Table; courses: Course[] }> {
  const store = getStore()
  const tid = one(sp.t)
  const byId = tid ? await store.getTable(tid) : null
  const own = byId && byId.userId === userId ? byId : null
  const semParam = one(sp.sem)
  const sem = own?.sem ?? (semParam && SEMS.includes(semParam) ? semParam : CURRENT_SEM)
  const tables = await store.listTables(userId, sem)
  const table = own ?? tables.find(t => t.primary) ?? tables[0]
  if (!table) throw new Error('timetable missing')
  return { sem, tables, table, courses: await store.listTableCourses(table.id) }
}

export const keyOf = (c: Pick<Course, 'code' | 'id'>) => c.code || c.id

export type TableItem = { key: string; code?: string; name: string; prof?: string; credit?: number; place: string; slots: Course[] }

/** 과목 단위로 묶은 목록(학점 합계·목록 보기용), 칸은 요일·시각 순 */
export function groupItems(courses: Course[]): TableItem[] {
  const by = new Map<string, TableItem>()
  for (const c of [...courses].sort((a, b) => a.day - b.day || a.start - b.start)) {
    const k = keyOf(c)
    const it = by.get(k) ?? { key: k, code: c.code, name: c.name, prof: c.prof, credit: c.credit, place: c.place, slots: [] }
    it.slots.push(c)
    by.set(k, it)
  }
  return [...by.values()]
}

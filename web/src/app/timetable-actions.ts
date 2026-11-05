'use server'
// 시간표 서버 액션: 수업 담기·빼기(겹침 검사), 직접 일정, 색, 시간표 만들기·이름·기본·삭제, 캡처 저장, 학점계산기 저장
import { randomUUID } from 'node:crypto'
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { PALETTE } from '@/components/TimetableGrid'
import { requireUser } from '@/lib/auth/session'
import { cleanInput } from '@/lib/board/flow'
import { getStore } from '@/lib/store'
import type { NewCourse } from '@/lib/store/types'
import { CUSTOM_PREFIX, catalogFromCourses, clash } from '@/lib/timetable/catalog'
import { MAX_CREDIT, MAX_ROWS, MAX_SEMS, isGrade, type GradeSemester } from '@/lib/timetable/grades'
import { SEMS } from '@/lib/timetable/sem'
import { SLOT_END, SLOT_START, isDay, normalizeParsed, toMin } from '@/lib/timetable/slots'
import { keyOf } from '@/lib/timetable/view'

/** 시간표 하나에 담을 수 있는 칸 수, 학기당 시간표 수 */
const MAX_SLOTS = 60
const MAX_TABLES = 10
/** 캡처 확인 화면에서 한 번에 저장할 수 있는 강의 수 */
const MAX_IMPORT = 40

const strip = ({ name, place, day, start, end, code, credit, prof }: NewCourse): NewCourse => ({ name, place, day, start, end, code, credit, prof })
/** 한 줄 입력: 파일·제어 문자는 버리고, 이모지 반쪽 없이 자른다 */
const text = (f: FormData, k: string, max: number) => cleanInput(f.get(k), max)
const back = (tableId: string) => `/timetable?t=${encodeURIComponent(tableId)}`
/** 돌아갈 주소는 시간표 화면 안으로만(바깥 주소로 보내는 열린 리디렉션 방지) */
const safeReturn = (to: unknown, tableId: string) => (typeof to === 'string' && /^\/timetable(?:[/?]|$)/.test(to) ? to : back(tableId))

/** 내 시간표만 고칠 수 있다. 남의 것이거나 없으면 시간표 화면으로 */
async function ownTable(id: unknown) {
  const me = await requireUser()
  const t = typeof id === 'string' && id ? await getStore().getTable(id) : null
  if (!t || t.userId !== me.id) redirect('/timetable')
  return t
}

export async function addFromCatalog(tableId: string, code: string, returnTo: string) {
  const t = await ownTable(tableId)
  if (typeof code !== 'string') return
  const store = getStore()
  const [catalog, mine] = await Promise.all([store.listCatalog(), store.listTableCourses(t.id)])
  const c = catalog.find(x => x.code === code)
  if (!c) return
  const slots = c.slots.filter(s => isDay(s.day) && s.start < s.end)
  if (!slots.length || mine.some(m => m.code === code) || clash(mine, slots) || mine.length + slots.length > MAX_SLOTS) return
  await store.replaceTableCourses(t.id, [
    ...mine.map(strip),
    ...slots.map(s => ({ name: c.name, place: c.place, day: s.day as NewCourse['day'], start: s.start, end: s.end, code: c.code, credit: c.credit, prof: c.prof })),
  ])
  redirect(safeReturn(returnTo, t.id))
}

/** 과목 키(강좌 코드 또는 직접 일정 id)에 해당하는 칸을 모두 빼고, 그 과목의 색 설정도 지운다 */
export async function removeItem(tableId: string, key: string, returnTo: string) {
  const t = await ownTable(tableId)
  const store = getStore()
  const mine = await store.listTableCourses(t.id)
  const left = mine.filter(c => keyOf(c) !== key)
  if (left.length !== mine.length) {
    await store.replaceTableCourses(t.id, left.map(strip))
    if (Object.hasOwn(t.colors, key)) await store.updateTable(t.id, { colors: Object.fromEntries(Object.entries(t.colors).filter(([k]) => k !== key)) })
  }
  redirect(safeReturn(returnTo, t.id))
}

export async function setColor(tableId: string, key: string, n: number) {
  const t = await ownTable(tableId)
  if (!Number.isInteger(n) || n < 0 || n >= PALETTE.length) return
  const mine = await getStore().listTableCourses(t.id)
  if (!mine.some(c => keyOf(c) === key)) return
  await getStore().updateTable(t.id, { colors: { ...t.colors, [key]: n } })
  refresh()
}

/** 직접 일정: 이름 20자, 장소 40자, 09:00–21:00 사이 30분 단위. 형식이 틀리거나 겹치면 이유를 돌려준다 */
export async function addCustom(tableId: string, f: FormData): Promise<{ error: 'clash' | 'invalid' } | void> {
  const t = await ownTable(tableId)
  const name = text(f, 'name', 20), place = text(f, 'place', 40)
  const day = Number(f.get('day')), start = toMin(f.get('start')), end = toMin(f.get('end'))
  const onGrid = (m: number) => Number.isInteger(m) && m % 30 === 0 && m >= SLOT_START && m <= SLOT_END
  if (!name || !isDay(day) || !onGrid(start) || !onGrid(end) || start >= end) return { error: 'invalid' }
  const store = getStore()
  const mine = await store.listTableCourses(t.id)
  const course: NewCourse = { name, place, day, start, end, code: `${CUSTOM_PREFIX}${randomUUID().slice(0, 8)}` }
  if (clash(mine, [course])) return { error: 'clash' }
  if (mine.length >= MAX_SLOTS) return { error: 'invalid' }
  await store.replaceTableCourses(t.id, [...mine.map(strip), course])
  redirect(back(t.id))
}

export async function createTable(sem: string, f: FormData) {
  const me = await requireUser()
  if (typeof sem !== 'string' || !SEMS.includes(sem)) redirect('/timetable')
  const store = getStore()
  const tables = await store.listTables(me.id, sem)
  if (tables.length >= MAX_TABLES) redirect(`/timetable?sem=${encodeURIComponent(sem)}&sheet=tables`)
  const name = text(f, 'name', 20) || `시간표 ${tables.length + 1}`
  const t = await store.createTable(me.id, sem, name)
  redirect(back(t.id))
}

export async function renameTable(tableId: string, f: FormData) {
  const t = await ownTable(tableId)
  const name = text(f, 'name', 20)
  if (name && name !== t.name) await getStore().updateTable(t.id, { name })
  redirect(back(t.id))
}

export async function makePrimary(tableId: string) {
  const t = await ownTable(tableId)
  if (!t.primary) await getStore().setPrimary(t.id)
  redirect(back(t.id))
}

/** 학기의 마지막 시간표는 스토어가 지우지 않는다 */
export async function removeTable(tableId: string) {
  const t = await ownTable(tableId)
  await getStore().deleteTable(t.id)
  redirect(`/timetable?sem=${encodeURIComponent(t.sem)}`)
}

const importSchema = z.array(z.object({
  name: z.string().max(200),
  place: z.string().max(200),
  day: z.number().int(),
  start: z.string().max(8),
  end: z.string().max(8),
})).min(1).max(MAX_IMPORT)

/** 캡처 확인 화면에서 고친 목록으로 시간표를 통째로 바꾸고, 강좌 목록에도 보탠다. 틀린 줄·겹침이 있으면 저장하지 않는다 */
export async function saveCourses(tableId: string, list: { name: string; place: string; day: number; start: string; end: string }[]): Promise<{ error: 'invalid' | 'overlap' } | void> {
  const t = await ownTable(tableId)
  const parsed = importSchema.safeParse(list)
  if (!parsed.success) return { error: 'invalid' }
  const { courses, warnings } = normalizeParsed(parsed.data)
  if (!courses.length || warnings.some(w => w.code === 'invalid')) return { error: 'invalid' }
  if (warnings.some(w => w.code === 'overlap')) return { error: 'overlap' }
  const store = getStore()
  const mine = catalogFromCourses(courses)
  await store.addCatalog(mine)
  const known = await store.listCatalog()
  const same = (a: { day: number; start: number; end: number }, b: { day: number; start: number; end: number }) => a.day === b.day && a.start === b.start && a.end === b.end
  await store.replaceTableCourses(t.id, courses.map(c => {
    // 같은 이름·강의실에 같은 시간 칸이 있는 강좌(같은 분반)를 먼저, 없으면 이번에 묶은 과목 코드
    const hit = known.find(k => k.name === c.name && k.place === c.place && k.slots.some(s => same(s, c)))
      ?? known.find(k => k.code === mine.find(m => m.name === c.name && m.place === c.place)?.code)
    return { ...c, code: hit?.code, credit: hit?.credit, prof: hit?.prof }
  }))
  redirect(back(t.id))
}

const gradesSchema = z.array(z.object({
  name: z.string().max(100),
  rows: z.array(z.object({
    name: z.string().max(200),
    credit: z.number().min(0).max(MAX_CREDIT),
    grade: z.string().refine(isGrade),
    major: z.boolean(),
  })).max(MAX_ROWS),
})).max(MAX_SEMS)

export async function saveGrades(sems: GradeSemester[]): Promise<{ error?: 'invalid' }> {
  const me = await requireUser()
  const parsed = gradesSchema.safeParse(sems)
  if (!parsed.success) return { error: 'invalid' }
  const clean: GradeSemester[] = parsed.data.map(s => ({
    name: cleanInput(s.name, 20),
    rows: s.rows.map(r => ({ name: cleanInput(r.name, 30), credit: r.credit, grade: r.grade, major: r.major })),
  }))
  await getStore().setGrades(me.id, clean)
  refresh()
  return {}
}

// 내 마감(공지에서 "신청 준비해 줘"로 담은 할 일) 저장소: Supabase notice_tasks 표, 표가 없거나 키가 없으면 서버 메모리.
// 공용 Store와 따로 둔다(다른 기능 작업과 파일이 겹치지 않게). 표는 supabase/notice-tasks.sql로 만든다
import 'server-only'
import { randomUUID } from 'node:crypto'
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import type { Apply } from '../ai'
import { has } from '../env'
import type { NoticeBoard } from '../school/notices'

export interface DeadlineTask {
  id: string
  userId: string
  board: NoticeBoard
  noticeId: string
  /** 담을 때의 사용자 언어 제목과 원문 제목 */
  title: string
  titleKo: string
  deadline: string | null
  /** 마감 순간(ms). 못 읽었으면 null(목록 맨 뒤) */
  dueAt: number | null
  url: string
  apply: Apply | null
  /** 체크한 준비물 번호 */
  checked: number[]
  done: boolean
  createdAt: number
}
export type NewDeadlineTask = Omit<DeadlineTask, 'id' | 'checked' | 'done' | 'createdAt'>
export type TaskPatch = Partial<Pick<DeadlineTask, 'checked' | 'done'>>

export interface TaskStore {
  /** 마감 가까운 순(완료한 것은 뒤로) */
  list(userId: string): Promise<DeadlineTask[]>
  get(userId: string, id: string): Promise<DeadlineTask | null>
  /** 같은 공지를 다시 담으면 내용만 새로 고친다(체크·완료는 유지) */
  save(t: NewDeadlineTask): Promise<DeadlineTask>
  update(userId: string, id: string, patch: TaskPatch): Promise<void>
  remove(userId: string, id: string): Promise<void>
}

export const MAX_TASKS = 50

export function sortTasks(list: DeadlineTask[]): DeadlineTask[] {
  return [...list].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.createdAt - a.createdAt)
}

export function createMemoryTaskStore(): TaskStore {
  const rows: DeadlineTask[] = []
  const copy = <T>(v: T): T => structuredClone(v)
  const find = (userId: string, id: string) => rows.find(r => r.userId === userId && r.id === id)
  return {
    async list(userId) { return copy(sortTasks(rows.filter(r => r.userId === userId))) },
    async get(userId, id) { return copy(find(userId, id) ?? null) },
    async save(t) {
      const old = rows.find(r => r.userId === t.userId && r.board === t.board && r.noticeId === t.noticeId)
      if (old) {
        Object.assign(old, copy(t))
        return copy(old)
      }
      const mine = rows.filter(r => r.userId === t.userId)
      if (mine.length >= MAX_TASKS) throw new Error('tasks: too many')
      const row: DeadlineTask = { ...copy(t), id: randomUUID(), checked: [], done: false, createdAt: Date.now() }
      rows.push(row)
      return copy(row)
    },
    async update(userId, id, patch) {
      const row = find(userId, id)
      if (row) Object.assign(row, copy(patch))
    },
    async remove(userId, id) {
      const i = rows.findIndex(r => r.userId === userId && r.id === id)
      if (i >= 0) rows.splice(i, 1)
    },
  }
}

/** 표가 없을 때 나는 오류(스키마를 아직 실행하지 않은 DB) */
const MISSING = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])
const missing = (e: PostgrestError | null) => !!e && MISSING.has(e.code)

type Row = { id: string; userId: string; board: string; noticeId: string; data: Omit<DeadlineTask, 'id' | 'userId' | 'board' | 'noticeId' | 'createdAt'>; createdAt: number }
const fromRow = (r: Row): DeadlineTask => ({ ...r.data, id: r.id, userId: r.userId, board: r.board as NoticeBoard, noticeId: r.noticeId, createdAt: Number(r.createdAt) })

/** Supabase 표를 쓰다가 표가 없으면(처음 한 번 경고) 메모리로 넘어간다: 발표장에서 기능이 멈추지 않게 */
export function createSupabaseTaskStore(db: SupabaseClient, fallback: TaskStore = createMemoryTaskStore()): TaskStore {
  let useMemory = false
  const fail = (e: PostgrestError | null): boolean => {
    if (!e) return false
    if (missing(e)) {
      if (!useMemory) console.warn('[deadlines] notice_tasks 표가 없어 서버 메모리에 저장합니다. supabase/notice-tasks.sql을 실행하세요')
      useMemory = true
      return true
    }
    throw new Error(`supabase: ${e.message}`, { cause: e })
  }
  const T = 'notice_tasks'
  const store: TaskStore = {
    async list(userId) {
      if (useMemory) return fallback.list(userId)
      const { data, error } = await db.from(T).select('*').eq('userId', userId).limit(MAX_TASKS)
      if (fail(error)) return fallback.list(userId)
      return sortTasks((data as Row[]).map(fromRow))
    },
    async get(userId, id) {
      if (useMemory) return fallback.get(userId, id)
      const { data, error } = await db.from(T).select('*').eq('userId', userId).eq('id', id).limit(1)
      if (fail(error)) return fallback.get(userId, id)
      const r = (data as Row[])[0]
      return r ? fromRow(r) : null
    },
    async save(t) {
      if (useMemory) return fallback.save(t)
      const { data: found, error: e1 } = await db.from(T).select('*').eq('userId', t.userId).eq('board', t.board).eq('noticeId', t.noticeId).limit(1)
      if (fail(e1)) return fallback.save(t)
      const old = (found as Row[])[0] ? fromRow((found as Row[])[0]) : null
      const { userId, board, noticeId, ...rest } = t
      const row: Row = {
        id: old?.id ?? randomUUID(), userId, board, noticeId,
        data: { ...rest, checked: old?.checked ?? [], done: old?.done ?? false },
        createdAt: old?.createdAt ?? Date.now(),
      }
      if (!old) {
        const { count, error: e2 } = await db.from(T).select('id', { count: 'exact', head: true }).eq('userId', userId)
        if (fail(e2)) return fallback.save(t)
        if ((count ?? 0) >= MAX_TASKS) throw new Error('tasks: too many')
      }
      const { error } = await db.from(T).upsert(row, { onConflict: 'userId,board,noticeId' })
      if (fail(error)) return fallback.save(t)
      return fromRow(row)
    },
    async update(userId, id, patch) {
      if (useMemory) return fallback.update(userId, id, patch)
      const cur = await store.get(userId, id)
      if (useMemory) return fallback.update(userId, id, patch)
      if (!cur) return
      const next = { ...cur, ...patch }
      const data: Row['data'] = { title: next.title, titleKo: next.titleKo, deadline: next.deadline, dueAt: next.dueAt, url: next.url, apply: next.apply, checked: next.checked, done: next.done }
      const { error } = await db.from(T).update({ data }).eq('userId', userId).eq('id', id)
      if (fail(error)) return fallback.update(userId, id, patch)
    },
    async remove(userId, id) {
      if (useMemory) return fallback.remove(userId, id)
      const { error } = await db.from(T).delete().eq('userId', userId).eq('id', id)
      if (fail(error)) return fallback.remove(userId, id)
    },
  }
  return store
}

const g = globalThis as typeof globalThis & { __unimateTasks?: TaskStore }

export function getTaskStore(): TaskStore {
  return (g.__unimateTasks ??= has.db
    ? createSupabaseTaskStore(createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }))
    : createMemoryTaskStore())
}

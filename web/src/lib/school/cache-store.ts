// 미리 만든 공지·학식 번역을 서버에 두는 저장소: Supabase Storage 버킷 'school-cache'의 JSON 파일(표를 만들 필요 없음).
// Supabase 키가 없거나 버킷을 쓸 수 없으면 서버 메모리(인스턴스마다 따로, 재시작하면 사라짐)
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { has } from '../env'

export interface CacheStore {
  get<T>(key: string): Promise<T | null>
  put(key: string, value: unknown): Promise<void>
  /** 다시 만들기 잠금: 아무도 안 잡았거나 ttl이 지난 잠금이면 잡고 true */
  claim(key: string, ttlMs: number): Promise<boolean>
  release(key: string): Promise<void>
}

export function createMemoryCacheStore(now: () => number = Date.now): CacheStore {
  const data = new Map<string, string>()
  const locks = new Map<string, number>()
  return {
    async get<T>(key: string) { const v = data.get(key); return v == null ? null : (JSON.parse(v) as T) },
    async put(key, value) { data.set(key, JSON.stringify(value)) },
    async claim(key, ttlMs) {
      const at = locks.get(key)
      if (at != null && now() - at < ttlMs) return false
      locks.set(key, now())
      return true
    },
    async release(key) { locks.delete(key) },
  }
}

const BUCKET = 'school-cache'
/** 저장 키는 영문·숫자·-만(경로 조작 방지) */
const safeKey = (key: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(key)) throw new Error(`cache: bad key ${key}`)
  return key
}

/** Supabase Storage 저장소. 버킷이 없으면 처음 한 번 만들고, 그래도 안 되면 메모리로 넘어간다 */
export function createStorageCacheStore(db: SupabaseClient, fallback: CacheStore = createMemoryCacheStore()): CacheStore {
  let ready: Promise<boolean> | null = null
  const ensure = () => (ready ??= (async () => {
    const { error } = await db.storage.createBucket(BUCKET, { public: false })
    if (!error || /already exists|duplicate/i.test(error.message)) return true
    console.warn(`[school-cache] 버킷을 쓸 수 없어 서버 메모리에 둡니다: ${error.message}`)
    return false
  })().catch(e => {
    console.warn('[school-cache] 버킷 확인 실패, 서버 메모리에 둡니다:', e instanceof Error ? e.message : e)
    return false
  }))
  const file = (key: string) => `${safeKey(key)}.json`
  const lockFile = (key: string) => `locks/${safeKey(key)}.json`
  const bucket = () => db.storage.from(BUCKET)
  const upload = (path: string, value: unknown, upsert: boolean) =>
    bucket().upload(path, new Blob([JSON.stringify(value)], { type: 'application/json' }), { upsert, contentType: 'application/json', cacheControl: '0' })
  async function read<T>(path: string): Promise<T | null> {
    const { data, error } = await bucket().download(path)
    if (error || !data) return null
    try { return JSON.parse(await data.text()) as T } catch { return null }
  }

  return {
    async get<T>(key: string) {
      if (!(await ensure())) return fallback.get<T>(key)
      return read<T>(file(key))
    },
    async put(key, value) {
      if (!(await ensure())) return fallback.put(key, value)
      const { error } = await upload(file(key), value, true)
      if (error) throw new Error(`school-cache: ${error.message}`)
    },
    async claim(key, ttlMs) {
      if (!(await ensure())) return fallback.claim(key, ttlMs)
      const { error } = await upload(lockFile(key), { at: Date.now() }, false)
      if (!error) return true
      // 이미 잠금이 있으면 오래된 것(만들다 죽은 인스턴스)만 덮어쓴다
      const lock = await read<{ at: number }>(lockFile(key))
      if (lock && Date.now() - lock.at < ttlMs) return false
      return !(await upload(lockFile(key), { at: Date.now() }, true)).error
    },
    async release(key) {
      if (!(await ensure())) return fallback.release(key)
      await bucket().remove([lockFile(key)])
    },
  }
}

const g = globalThis as typeof globalThis & { __uniSchoolCache?: CacheStore }

export function getCacheStore(): CacheStore {
  return (g.__uniSchoolCache ??= has.db
    ? createStorageCacheStore(createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }))
    : createMemoryCacheStore())
}

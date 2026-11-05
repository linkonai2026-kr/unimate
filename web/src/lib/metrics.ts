// 익명 사용 통계: 브라우저 이벤트 검증, 서버 작업 시간·성공 기록, 저장(Supabase events 표 또는 서버 메모리), /stats 집계·CSV·접근 확인
// 방문객은 익명(브라우저가 만든 무작위 세션 id만), 로그인한 사용자는 서버가 세션 쿠키로 확인한 계정 id를 붙인다(브라우저가 보낸 id는 믿지 않는다).
// IP는 저장하지 않는다. 기록이 실패해도 화면·응답에는 영향을 주지 않는다
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { z } from 'zod'
import { has } from './env'
import { LANGS } from './i18n'

/* ───────────── 이벤트 형식과 검증 ───────────── */

export const MAX_MS = 2 * 60 * 60_000
export const clampMs = (v: number) => (Number.isFinite(v) ? Math.min(MAX_MS, Math.max(0, Math.round(v))) : 0)

const LANG_CODES = LANGS.map(l => l.code) as [string, ...string[]]
const ms = z.number().transform(clampMs)
const lang = z.enum(LANG_CODES)
const board = z.enum(['academic', 'general'])
const noticeId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/)
const common = {
  visitor: z.boolean(),
  lang: lang.optional(),
  path: z.string().max(200).optional(),
  /** 화면 한 번 보기의 무작위 id(같은 화면에서 나눠 보낸 머문 시간을 합칠 때) */
  vid: z.string().regex(/^[A-Za-z0-9]{4,16}$/).optional(),
}

export const ACTIONS = ['ics', 'route', 'apply_page', 'prepare', 'original'] as const
export const FAILS = ['notice_snapshot', 'notice_empty', 'menu_error', 'menu_cached'] as const

/** 사진·주소의 쿼리를 지우고 200자로 자른 오류 문장(스택은 받지 않는다) */
export function cleanMessage(s: string): string {
  return s.replace(/(https?:\/\/[^\s?#'"]+)[?#][^\s'"]*/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 200)
}

const clientEvent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('view'), ...common, nav: z.enum(['load', 'spa']), ttfb: ms.optional(), dcl: ms.optional(), load: ms.optional(), spa: ms.optional() }),
  z.object({ kind: z.literal('lang'), ...common, picked: lang }),
  z.object({ kind: z.literal('notice_open'), ...common, board, id: noticeId, ms, first: z.boolean().optional() }),
  z.object({ kind: z.literal('notice_dwell'), ...common, scope: z.enum(['notice', 'page']), board: board.optional(), id: noticeId.optional(), ms }),
  z.object({ kind: z.literal('action'), ...common, action: z.enum(ACTIONS), board: board.optional(), id: noticeId.optional() }),
  z.object({ kind: z.literal('error'), ...common, type: z.enum(['error', 'rejection']), message: z.string().max(1000).transform(cleanMessage) }),
  z.object({ kind: z.literal('fail'), ...common, what: z.enum(FAILS) }),
])
export type ClientEvent = z.infer<typeof clientEvent>

export const SID_RE = /^[A-Za-z0-9-]{8,64}$/
export const MAX_BATCH = 20
export const MAX_BODY = 16 * 1024

export type EventKind = ClientEvent['kind'] | 'op'
/** 저장하는 한 줄. data: 종류별 값(숫자·짧은 글자만) */
export interface EventRow {
  at: number
  kind: EventKind
  sid: string | null
  /** 로그인한 사용자 id(서버가 세션 쿠키로 확인), 방문객·서버 작업은 null */
  uid: string | null
  visitor: boolean | null
  lang: string | null
  path: string | null
  data: Record<string, unknown>
}

/** 주소를 통계용으로 줄인다: 쿼리 없이 두 단계까지, 아이디·글 번호 같은 칸은 *로 */
const KNOWN_SUB = /^(?:add|new|edit|activity|password|import|map|menu|notices|parse)$/
export function normalizePath(p: string | undefined | null): string | null {
  if (!p) return null
  const segs = p.split(/[?#]/)[0].split('/').filter(Boolean).slice(0, 3)
  if (segs.length === 0) return '/'
  const out = segs.map((s, i) => (i === 0 ? (/^[a-z-]{1,20}$/.test(s) ? s : '*') : KNOWN_SUB.test(s) ? s : '*'))
  return `/${out.join('/')}`
}

/**
 * 브라우저가 보낸 묶음을 검사해 저장할 줄로 바꾼다. 형식이 틀린 이벤트는 그것만 버린다.
 * 묶음 자체(세션 id·배열)가 틀리면 null. uid: 서버가 세션 쿠키로 확인한 사용자 id
 */
export function parseBatch(body: unknown, now = Date.now(), uid: string | null = null): EventRow[] | null {
  if (!body || typeof body !== 'object') return null
  const { sid, events } = body as { sid?: unknown; events?: unknown }
  if (typeof sid !== 'string' || !SID_RE.test(sid) || !Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) return null
  const out: EventRow[] = []
  for (const raw of events) {
    const r = clientEvent.safeParse(raw)
    if (!r.success) continue
    const { kind, visitor, lang: l, path, ...data } = r.data
    out.push({ at: now, kind, sid, uid, visitor, lang: l ?? null, path: normalizePath(path), data })
  }
  return out
}

/* ───────────── 저장소 ───────────── */

export interface MetricsStore {
  add(rows: EventRow[]): Promise<void>
  /** [since, until) 사이 줄(오래된 것부터). missing: DB에 events 표가 없음 */
  list(since: number, until: number): Promise<{ rows: EventRow[]; missing: boolean }>
}

export const MEMORY_LIMIT = 20_000

export function createMemoryMetrics(limit = MEMORY_LIMIT): MetricsStore {
  const rows: EventRow[] = []
  return {
    async add(list) {
      rows.push(...list.map(r => structuredClone(r)))
      if (rows.length > limit) rows.splice(0, rows.length - limit)
    },
    async list(since, until) {
      return { rows: rows.filter(r => r.at >= since && r.at < until).map(r => structuredClone(r)), missing: false }
    },
  }
}

const MISSING = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])
const PAGE = 1000, MAX_PAGES = 100

/** 표가 없다고 본 뒤 다시 확인하기까지(SQL을 나중에 실행해도 서버를 다시 띄우지 않고 1분 안에 저장이 시작되게) */
const MISSING_RETRY_MS = 60_000

/** events 표가 없으면 경고하고 이벤트를 버린다(앱은 그대로 돈다). 1분마다 다시 확인하고, 성공하면 바로 정상으로 돌아온다 */
export function createSupabaseMetrics(db: SupabaseClient, now: () => number = Date.now): MetricsStore {
  let missing = false
  let missingAt = 0
  const check = (e: PostgrestError | null): boolean => {
    if (!e) {
      missing = false
      return true
    }
    if (MISSING.has(e.code)) {
      if (!missing) console.warn('[metrics] events 표가 없어 사용 통계를 버립니다. supabase/schema.sql 끝의 "익명 사용 통계" 블록을 실행하세요')
      missing = true
      missingAt = now()
    } else console.warn('[metrics]', e.code, e.message)
    return false
  }
  return {
    async add(list) {
      if (list.length === 0 || (missing && now() - missingAt < MISSING_RETRY_MS)) return
      const { error } = await db.from('events').insert(list)
      check(error)
    },
    async list(since, until) {
      const out: EventRow[] = []
      for (let p = 0; p < MAX_PAGES; p++) {
        const { data, error } = await db.from('events').select('at,kind,sid,uid,visitor,lang,path,data')
          .gte('at', since).lt('at', until).order('at').order('id').range(p * PAGE, p * PAGE + PAGE - 1)
        if (!check(error)) return { rows: out, missing }
        const page = ((data ?? []) as EventRow[]).map(r => ({ ...r, at: Number(r.at), data: r.data ?? {} }))
        out.push(...page)
        if (page.length < PAGE) break
      }
      return { rows: out, missing }
    },
  }
}

const g = globalThis as typeof globalThis & { __unimateMetrics?: MetricsStore }

/** 운영 배포(Vercel production)에서만 Supabase에 기록한다. 로컬 개발 서버·테스트·스크립트가 같은 DB를 써도 통계에 섞이지 않는다 */
export const recordsToDb = () => process.env.VERCEL_ENV === 'production'

export function getMetrics(): MetricsStore {
  if (g.__unimateMetrics) return g.__unimateMetrics
  if (!has.db) return (g.__unimateMetrics = createMemoryMetrics())
  const db = createSupabaseMetrics(createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  }))
  // 운영이 아니면 읽기(/stats)는 그대로 운영 기록을 보여 주고, 쓰기만 버린다
  return (g.__unimateMetrics = recordsToDb() ? db : { ...db, add: async () => {} })
}

/** 응답을 보낸 뒤 저장한다(요청 밖에서 부르면 그냥 뒤에서 돌린다). 절대 던지지 않는다 */
export function saveLater(rows: EventRow[]): void {
  if (rows.length === 0) return
  const run = () => getMetrics().add(rows).catch(e => console.warn('[metrics] save failed:', e instanceof Error ? e.message : e))
  try {
    after(run)
  } catch {
    void run()
  }
}

/* ───────────── 서버 작업 기록 ───────────── */

export type ServerOp = 'notices' | 'notice_detail' | 'ai_summary' | 'ai_list' | 'ai_translate' | 'ai_timetable' | 'menu' | 'route'
export const OP_LABEL: Record<ServerOp, string> = {
  notices: '공지 목록(화면 준비 전체)',
  notice_detail: '공지 상세 받기',
  ai_summary: 'AI 공지 요약',
  ai_list: 'AI 목록 번역(제목·식단·길 안내)',
  ai_translate: 'AI 글 번역',
  ai_timetable: 'AI 시간표 인식',
  menu: '식단',
  route: '길찾기 API',
}

/** 서버가 직접 잰 작업 시간과 결과. ok: 정상, source: live·snapshot·cached·tmap·straight·fallback·error 같은 짧은 출처 */
export function recordServer(op: ServerOp, { ms: took, ok, source }: { ms: number; ok: boolean; source?: string }): void {
  try {
    saveLater([{ at: Date.now(), kind: 'op', sid: null, uid: null, visitor: null, lang: null, path: null, data: { op, ms: clampMs(took), ok, source: (source ?? (ok ? 'ok' : 'error')).slice(0, 20) } }])
  } catch { /* 통계는 앱을 멈추지 않는다 */ }
}

/** 프로미스를 그대로 돌려주면서 걸린 시간과 성공 여부를 기록한다 */
export function timed<T>(op: ServerOp, p: Promise<T>, source?: (v: T) => { ok: boolean; source: string }): Promise<T> {
  const t0 = Date.now()
  p.then(v => recordServer(op, { ms: Date.now() - t0, ...(source ? source(v) : { ok: true, source: 'ok' }) }),
    () => recordServer(op, { ms: Date.now() - t0, ok: false, source: 'error' }))
  return p
}

/* ───────────── /stats 접근 ───────────── */

/** STATS_KEY가 비었거나 다르면 false(길이를 흘리지 않게 해시끼리 고정 시간 비교) */
export function statsAllowed(key: unknown, secret = process.env.STATS_KEY): boolean {
  const want = secret?.trim()
  if (!want || typeof key !== 'string' || !key) return false
  const h = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(h(key), h(want))
}

/* ───────────── 집계 ───────────── */

/** 분위수(선형 보간, 엑셀 PERCENTILE.INC와 같다). 값이 없으면 null */
export function quantile(values: number[], q: number): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (v.length === 0) return null
  const pos = (v.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return v[lo] + (v[hi] - v[lo]) * (pos - lo)
}
export interface Summary { n: number; median: number | null; p75: number | null; p95: number | null }
export const summarize = (values: number[]): Summary => ({ n: values.length, median: quantile(values, 0.5), p75: quantile(values, 0.75), p95: quantile(values, 0.95) })

const KST = 9 * 60 * 60_000
export const kstDate = (ms: number) => new Date(ms + KST).toISOString().slice(0, 10)
/** 한국 날짜 YYYY-MM-DD의 0시(ms). 틀린 형식이면 null */
export function kstStart(day: string | undefined | null): number | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const t = Date.parse(`${day}T00:00:00+09:00`)
  return Number.isFinite(t) ? t : null
}

export interface SignupProfile { id: string; handle: string; nickname: string; nationality: string; lang: string; createdAt: number }
/** 시드·데모 계정(id가 u-로 시작, 실제 가입은 uuid) */
export const isDemoProfile = (p: { id: string }) => p.id.startsWith('u-')

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const isNoticesPath = (p: string | null) => !!p && /\/notices$/.test(p)
const count = <K extends string>(list: K[]) => list.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {})

export const FUNNEL = [
  { id: 'visit', label: '방문(방문객 화면)' },
  { id: 'lang', label: '언어 선택' },
  { id: 'notices', label: '공지 화면' },
  { id: 'open', label: '공지 열기(누름)' },
] as const

export interface OpStats extends Summary { op: string; label: string; ok: number; rate: number | null; sources: Record<string, number> }

/** profiles: 기간 안에 가입한 계정, users: 이벤트의 uid를 아이디·닉네임으로 바꿀 전체 계정 */
export function computeStats(rows: EventRow[], profiles: SignupProfile[], users: SignupProfile[] = profiles) {
  const client = rows.filter(r => r.kind !== 'op' && r.sid)
  const bySid = new Map<string, EventRow[]>()
  for (const r of client) {
    const list = bySid.get(r.sid!) ?? []
    list.push(r)
    bySid.set(r.sid!, list)
  }

  // 세션(=브라우저) 수: 전체·방문객·로그인
  const sessions = { total: bySid.size, visitor: 0, member: 0 }
  for (const list of bySid.values()) {
    if (list.some(r => r.visitor === true)) sessions.visitor++
    if (list.some(r => r.visitor === false)) sessions.member++
  }

  // 일별(한국 날짜)
  const days = new Map<string, { sids: Set<string>; v: Set<string>; m: Set<string>; views: number; opens: number; signups: number }>()
  const day = (d: string) => {
    let x = days.get(d)
    if (!x) days.set(d, (x = { sids: new Set(), v: new Set(), m: new Set(), views: 0, opens: 0, signups: 0 }))
    return x
  }
  for (const r of client) {
    const x = day(kstDate(r.at))
    x.sids.add(r.sid!)
    if (r.visitor === true) x.v.add(r.sid!)
    if (r.visitor === false) x.m.add(r.sid!)
    if (r.kind === 'view') x.views++
    if (r.kind === 'notice_open') x.opens++
  }

  // 언어: 화면 언어별 세션 수(세션의 마지막 화면 언어), 방문객이 고른 언어 횟수
  const uiLang: Record<string, number> = {}
  for (const list of bySid.values()) {
    const last = list.filter(r => r.kind === 'view' && r.lang).at(-1)?.lang
    if (last) uiLang[last] = (uiLang[last] ?? 0) + 1
  }
  const picked = count(client.filter(r => r.kind === 'lang').map(r => str(r.data.picked)).filter(Boolean))

  // 공지 열기·도우미 버튼
  const opens = client.filter(r => r.kind === 'notice_open')
  const actions = count(client.filter(r => r.kind === 'action').map(r => str(r.data.action)))

  // 첫 공지 열기까지(공지 화면을 본 뒤 ms, 세션마다 첫 번째)
  const firstOpen: number[] = []
  for (const list of bySid.values()) {
    const o = list.find(r => r.kind === 'notice_open')
    const v = o && num(o.data.ms)
    if (v != null) firstOpen.push(v)
  }
  // 첫 화면 → 공지 화면 도착(세션마다, 서버 시각 기준, 2시간 이내만)
  const toNotices: number[] = []
  for (const list of bySid.values()) {
    const views = list.filter(r => r.kind === 'view')
    const first = views[0], n = views.find(r => isNoticesPath(r.path))
    if (first && n && n.at - first.at <= MAX_MS) toNotices.push(n.at - first.at)
  }
  // 머문 시간: 같은 화면 보기(vid)·같은 공지끼리 합친다
  const dwell = (scope: 'notice' | 'page') => {
    const sums = new Map<string, number>()
    client.filter(r => r.kind === 'notice_dwell' && r.data.scope === scope).forEach((r, i) => {
      const k = r.data.vid ? `${r.sid}:${str(r.data.vid)}:${scope === 'notice' ? `${str(r.data.board)}:${str(r.data.id)}` : ''}` : `#${i}`
      sums.set(k, Math.min(MAX_MS, (sums.get(k) ?? 0) + (num(r.data.ms) ?? 0)))
    })
    return [...sums.values()]
  }

  // 퍼널(방문객 세션). counts: 그 단계를 한 세션, nested: 앞 단계를 모두 거친 세션
  const steps: Record<(typeof FUNNEL)[number]['id'], (l: EventRow[]) => boolean> = {
    visit: l => l.some(r => r.kind === 'view' && r.visitor === true),
    lang: l => l.some(r => r.kind === 'lang' && r.visitor === true),
    notices: l => l.some(r => r.kind === 'view' && r.visitor === true && isNoticesPath(r.path)),
    open: l => l.some(r => r.kind === 'notice_open' && r.visitor === true),
  }
  const funnel = FUNNEL.map(s => ({ ...s, sessions: 0, nested: 0 }))
  for (const list of bySid.values()) {
    let ok = true
    funnel.forEach(f => {
      const did = steps[f.id](list)
      if (did) f.sessions++
      ok = ok && did
      if (ok) f.nested++
    })
  }

  // 화면 열림 시간(첫 접속: 서버 첫 응답·DOM 준비·전체 로드, 앱 안 이동: 누른 뒤 화면이 바뀔 때까지)
  const load = (visitor: boolean) => {
    const v = client.filter(r => r.kind === 'view' && r.visitor === visitor)
    const pick = (k: string) => v.map(r => num(r.data[k])).filter((x): x is number => x != null)
    return { ttfb: summarize(pick('ttfb')), dcl: summarize(pick('dcl')), load: summarize(pick('load')), spa: summarize(pick('spa')) }
  }

  // 서버 작업
  const opsMap = new Map<string, EventRow[]>()
  for (const r of rows) {
    if (r.kind !== 'op') continue
    const k = str(r.data.op)
    const list = opsMap.get(k) ?? []
    list.push(r)
    opsMap.set(k, list)
  }
  const ops: OpStats[] = [...opsMap].map(([op, list]) => {
    const ok = list.filter(r => r.data.ok === true).length
    return {
      op, label: OP_LABEL[op as ServerOp] ?? op, ...summarize(list.map(r => num(r.data.ms) ?? 0)),
      ok, rate: list.length ? ok / list.length : null, sources: count(list.map(r => str(r.data.source) || '-')),
    }
  }).sort((a, b) => b.n - a.n)

  // 오류
  const errs = client.filter(r => r.kind === 'error')
  const msgCount = count(errs.map(r => str(r.data.message) || '(빈 메시지)'))
  const errors = {
    byType: count(errs.map(r => str(r.data.type))),
    top: Object.entries(msgCount).map(([message, n]) => ({ message, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    fails: count(client.filter(r => r.kind === 'fail').map(r => str(r.data.what))),
  }

  // 가입(데모 계정 제외, 최신 순)
  const real = profiles.filter(p => !isDemoProfile(p)).sort((a, b) => b.createdAt - a.createdAt)
  for (const p of real) day(kstDate(p.createdAt)).signups++
  const signups = {
    total: real.length,
    demoExcluded: profiles.length - real.length,
    byNationality: count(real.map(p => p.nationality || '-')),
    byLang: count(real.map(p => p.lang || '-')),
    rows: real.map(p => ({ at: p.createdAt, handle: p.handle, nickname: p.nickname, nationality: p.nationality, lang: p.lang })),
  }

  // 로그인 사용자별(서버가 붙인 uid 기준, 최근 활동 순)
  const byUid = new Map<string, EventRow[]>()
  for (const r of client) {
    if (!r.uid) continue
    const list = byUid.get(r.uid) ?? []
    list.push(r)
    byUid.set(r.uid, list)
  }
  const who = new Map(users.map(p => [p.id, p]))
  const perUser = [...byUid].map(([uid, list]) => {
    const p = who.get(uid)
    const o = list.filter(r => r.kind === 'notice_open')
    return {
      uid, handle: p?.handle ?? '(삭제된 계정)', nickname: p?.nickname ?? '', nationality: p?.nationality ?? '', lang: p?.lang ?? '',
      lastSeen: Math.max(...list.map(r => r.at)), views: list.filter(r => r.kind === 'view').length, opens: o.length,
      openMedian: quantile(o.map(r => num(r.data.ms)).filter((x): x is number => x != null), 0.5),
    }
  }).sort((a, b) => b.lastSeen - a.lastSeen)

  return {
    sessions,
    perUser,
    daily: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([d, x]) => ({ day: d, sessions: x.sids.size, visitor: x.v.size, member: x.m.size, views: x.views, opens: x.opens, signups: x.signups })),
    langs: { ui: uiLang, picked },
    notices: { opens: opens.length, openSessions: new Set(opens.map(r => r.sid)).size, actions },
    timing: { firstOpen: summarize(firstOpen), toNotices: summarize(toNotices), noticeDwell: summarize(dwell('notice')), pageDwell: summarize(dwell('page')) },
    funnel,
    pageLoad: { visitor: load(true), member: load(false) },
    ops,
    errors,
    signups,
  }
}
export type Stats = ReturnType<typeof computeStats>

/* ───────────── CSV ───────────── */

/** 칸 하나: 늘 따옴표로 감싸고, 줄바꿈은 공백으로, 수식으로 읽힐 글자(= + - @ 탭)로 시작하면 앞에 ' */
export function csvCell(v: unknown): string {
  if (v == null) return '""'
  if (typeof v === 'number') return Number.isFinite(v) ? `"${v}"` : '""'
  let s = String(v).replace(/\r\n|\r|\n/g, ' ')
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
/** UTF-8 BOM을 붙인 CSV(엑셀에서 한글이 깨지지 않게) */
export const toCsv = (rows: unknown[][]) => `﻿${rows.map(r => r.map(csvCell).join(',')).join('\r\n')}\r\n`

const sec = (v: number | null) => (v == null ? null : Math.round(v / 100) / 10)
const pct = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 10)
export const fmtKst = (ms: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)

/** 발표 자료용 요약: 표 여러 개를 빈 줄로 나눠 한 파일에 */
export function eventsCsv(s: Stats): string {
  const t = (name: string, sum: Summary) => [name, sum.n, sec(sum.median), sec(sum.p75), sec(sum.p95)]
  const rows: unknown[][] = [
    ['[세션]'], ['전체', '방문객', '로그인'], [s.sessions.total, s.sessions.visitor, s.sessions.member], [],
    ['[일별(한국 날짜)]'], ['날짜', '세션', '방문객 세션', '로그인 세션', '화면 보기', '공지 열기', '가입'],
    ...s.daily.map(d => [d.day, d.sessions, d.visitor, d.member, d.views, d.opens, d.signups]), [],
    ['[걸린 시간(초)]'], ['항목', '건수', '중앙값', 'p75', 'p95'],
    t('첫 화면→공지 화면 도착', s.timing.toNotices), t('공지 화면→첫 공지 열기', s.timing.firstOpen),
    t('공지 한 건 화면에 보인 시간', s.timing.noticeDwell), t('공지 화면 머문 시간', s.timing.pageDwell), [],
    ['[퍼널(방문객)]'], ['단계', '세션', '앞 단계를 모두 거친 세션'], ...s.funnel.map(f => [f.label, f.sessions, f.nested]), [],
    ['[언어]'], ['언어', '화면 언어 세션', '방문객이 고른 횟수'],
    ...LANG_CODES.map(l => [l, s.langs.ui[l] ?? 0, s.langs.picked[l] ?? 0]), [],
    ['[공지]'], ['공지 열기', '연 세션', ...ACTIONS.map(a => `버튼:${a}`)],
    [s.notices.opens, s.notices.openSessions, ...ACTIONS.map(a => s.notices.actions[a] ?? 0)], [],
    ['[화면 열림 시간(초)]'], ['구분', '항목', '건수', '중앙값', 'p75', 'p95'],
    ...(['visitor', 'member'] as const).flatMap(k => (['ttfb', 'dcl', 'load', 'spa'] as const).map(m => [k === 'visitor' ? '방문객' : '로그인', ...t(m, s.pageLoad[k][m])])), [],
    ['[서버 작업]'], ['작업', '건수', '성공', '성공률(%)', '중앙값(초)', 'p75(초)', 'p95(초)', '출처'],
    ...s.ops.map(o => [o.label, o.n, o.ok, pct(o.rate), sec(o.median), sec(o.p75), sec(o.p95), Object.entries(o.sources).map(([k, n]) => `${k}:${n}`).join(' ')]), [],
    ['[오류·실패 화면]'], ['종류', '건수'],
    ...Object.entries(s.errors.byType).map(([k, n]) => [`오류:${k}`, n]), ...Object.entries(s.errors.fails).map(([k, n]) => [`실패 화면:${k}`, n]),
    ...s.errors.top.map(e => [`메시지:${e.message}`, e.n]),
  ]
  return toCsv(rows)
}

export function usersCsv(s: Stats): string {
  return toCsv([['아이디', '닉네임', '국적', '언어', '마지막 활동(KST)', '화면 보기', '공지 열기', '공지 열기까지 중앙값(초)'],
    ...s.perUser.map(u => [u.handle, u.nickname, u.nationality, u.lang, fmtKst(u.lastSeen), u.views, u.opens, sec(u.openMedian)])])
}

export function signupsCsv(s: Stats): string {
  return toCsv([['가입 시각(KST)', '아이디', '닉네임', '국적', '언어'], ...s.signups.rows.map(r => [fmtKst(r.at), r.handle, r.nickname, r.nationality, r.lang])])
}

/** /stats와 CSV가 같이 쓰는 기간 해석(한국 날짜, 기본 최근 30일)과 데이터 읽기 */
export function statsRange(from?: string | null, to?: string | null, now = Date.now()) {
  const end = (kstStart(to) ?? kstStart(kstDate(now))!) + 24 * 60 * 60_000
  const start = kstStart(from) ?? end - 30 * 24 * 60 * 60_000
  return { start: Math.min(start, end), end }
}

/** 기간 안의 이벤트와 가입자를 읽어 집계한다(가입자는 공용 저장소의 프로필) */
export async function loadStats(range: { start: number; end: number }): Promise<{ stats: Stats; missing: boolean; rows: number }> {
  const { getStore } = await import('./store')
  const [{ rows, missing }, profiles] = await Promise.all([
    getMetrics().list(range.start, range.end),
    getStore().listProfiles().catch(() => []),
  ])
  const inRange = profiles.filter(p => p.createdAt >= range.start && p.createdAt < range.end)
  return { stats: computeStats(rows, inRange, profiles), missing, rows: rows.length }
}

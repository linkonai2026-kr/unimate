// 공지·학식 번역을 사용자 요청 때가 아니라 미리 만들어 두는 곳.
// - 공지: 하루 한 번(한국 날짜) 학사·일반 목록을 받아 다섯 언어 제목 번역·3줄 요약·마감·신청 정보를 만들어 저장
//   (어제 이미 요약한 공지는 다시 요약하지 않는다: 새 공지만 AI를 부른다)
// - 학식: 한 주에 한 번(학교 사이트의 일~토 주 기준) 메뉴 이름을 다섯 언어로 번역해 저장(이미 번역한 이름은 다시 쓰지 않는다)
// 화면은 저장본만 읽는다. 저장본이 오늘(이번 주) 것이 아니면 있는 저장본을 바로 보여 주고, 뒤에서 한 번만 다시 만든다(잠금)
import 'server-only'
import { after } from 'next/server'
import { summarizeNotice, translateList, type Apply } from '../ai'
import { has } from '../env'
import { LANGS, type Lang } from '../i18n'
import { getCacheStore, type CacheStore } from './cache-store'
import { getMenu, menuTargetDay, type MenuWeek } from './menu'
import { addDays, kstDay } from './memo'
import { dDay, getNoticeHtml, getNotices, parseNoticeBody, parseNoticeDetail, postedToday, type Notice, type NoticeBoard } from './notices'

/** 목록에 보여 주는 공지 수(공지 화면 8건, 홈은 앞 3건) */
export const NOTICE_LIMIT = 8
const CODES = LANGS.map(l => l.code)
/** 동시에 부르는 AI 요청 수 */
const AI_CONCURRENCY = 6
/** 다시 만들기 잠금 유효 시간(만들다 죽으면 이 시간 뒤 다른 인스턴스가 이어받는다) */
const LOCK_MS = 10 * 60_000
/** 요약이 일부 실패한 저장본은 이만큼 지난 뒤 실패한 것만 다시 만든다 */
const RETRY_MS = 30 * 60_000
/** 같은 인스턴스에서 저장본을 다시 읽는 간격(매 요청마다 Storage를 부르지 않게) */
const READ_TTL = 60_000

/** 저장하는 공지 카드(오늘 글 표시·D-day는 날짜가 바뀌므로 읽을 때 계산) */
export interface StoredCard extends Notice {
  titleTr: string
  excerpt: string
  images: number
  files: string[]
  bullets: string[]
  deadline: string | null
  apply: Apply | null
}
export interface NoticeSnap { day: string; builtAt: number; source: 'live' | 'snapshot'; missing: number; items: StoredCard[] }
/** 메뉴 이름 번역 사전(원문 → 번역). weekKey: 마지막으로 만든 주 */
export interface MenuDict { weekKey: string; builtAt: number; tr: Record<string, string> }

export const noticeKey = (board: NoticeBoard, lang: Lang) => `notices-${board}-${lang}`
export const menuKey = (lang: Lang) => `menu-${lang}`

/** 식단 주의 기준(학교 사이트는 일~토 한 주를 보여 준다): 그 주 일요일 날짜. 토요일부터는 다음 주 */
export const weekKey = (now = Date.now()) => {
  const day = menuTargetDay(now)
  return addDays(day, -day.dow).iso
}

/** 동시에 n개씩 */
async function pool<T, R>(items: T[], n: number, run: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await run(items[i])
    }
  }))
  return out
}

/** 공지 한 게시판을 다섯 언어로 만든다. prev: 지난 저장본(이미 요약한 공지는 그대로 쓴다) */
export async function buildNotices(board: NoticeBoard, store: CacheStore = getCacheStore(), now = Date.now(), opts: { retitle?: boolean } = {}): Promise<Record<Lang, NoticeSnap>> {
  const day = kstDay(now).iso
  const { items, source } = await getNotices(board, NOTICE_LIMIT)
  const prev = Object.fromEntries(await Promise.all(CODES.map(async l => [l, await store.get<NoticeSnap>(noticeKey(board, l)).catch(() => null)] as const))) as Record<Lang, NoticeSnap | null>
  const old = (l: Lang, id: string) => prev[l]?.items.find(x => x.id === id && x.bullets.length > 0)

  // 상세는 공지마다 한 번만 받는다(언어와 상관없음)
  const details = await pool(items, 4, async n => {
    if (source !== 'live') return null
    const html = await getNoticeHtml(n.board, n.id)
    return html ? { ...parseNoticeDetail(html), body: parseNoticeBody(html) } : null
  })

  // 제목 번역: 언어마다 한 번(새 제목만). retitle이면 번역 지침을 고친 뒤처럼 저장된 제목도 모두 다시 번역(요약은 그대로 둔다)
  const titles = Object.fromEntries(await Promise.all(CODES.map(async l => {
    const need = opts.retitle ? items : items.filter(n => !old(l, n.id))
    const tr = l === 'ko' || need.length === 0 ? need.map(n => n.title) : await translateList(need.map(n => n.title), l)
    const map = new Map(need.map((n, i) => [n.id, tr[i] || n.title]))
    return [l, items.map(n => (opts.retitle ? undefined : old(l, n.id)?.titleTr) ?? map.get(n.id) ?? n.title)] as const
  }))) as Record<Lang, string[]>

  // 요약: 새 공지 × 언어만 AI를 부른다
  const jobs = CODES.flatMap(l => items.map((n, i) => ({ l, n, i }))).filter(j => !old(j.l, j.n.id) && details[j.i]?.body && has.ai)
  const sums = new Map<string, Awaited<ReturnType<typeof summarizeNotice>> | null>()
  await pool(jobs, AI_CONCURRENCY, async ({ l, n, i }) => {
    const s = await summarizeNotice(n.title, details[i]!.body, l).catch(() => null)
    sums.set(`${l}:${n.id}`, s)
  })

  const snaps = {} as Record<Lang, NoticeSnap>
  await Promise.all(CODES.map(async l => {
    let missing = 0
    const cards = items.map((n, i): StoredCard => {
      const reuse = old(l, n.id)
      if (reuse) return { ...reuse, ...n, titleTr: titles[l][i] }
      const d = details[i]
      const s = sums.get(`${l}:${n.id}`) ?? null
      if (has.ai && d?.body && !s) missing++
      return {
        ...n, titleTr: titles[l][i], excerpt: d?.text.slice(0, 160) ?? '', images: d?.images ?? 0, files: d?.files ?? [],
        bullets: s?.bullets ?? [], deadline: s?.deadline ?? null, apply: s?.apply ?? null,
      }
    })
    const snap: NoticeSnap = { day, builtAt: now, source, missing, items: cards }
    await store.put(noticeKey(board, l), snap)
    snaps[l] = snap
  }))
  return snaps
}

/** 식단에 나오는 이름(코너·메뉴) */
export const menuNames = (week: MenuWeek) => [...new Set(week.corners.flatMap(c => [c.name, ...c.meals.flatMap(m => m.byDay.flat())]))]

/**
 * 메뉴 이름 번역 사전을 만든다(한 주에 한 번). 식단 자체는 화면이 늘 학교 사이트에서 새로 받고, 이름 번역만 이 사전에서 찾는다.
 * 사전은 쌓아 간다: 이미 번역한 이름은 다시 번역하지 않고 새 이름만 AI를 부른다
 */
export async function buildMenu(store: CacheStore = getCacheStore(), now = Date.now()): Promise<boolean> {
  const r = await getMenu(undefined, now)
  if (!r.week) return false
  const names = menuNames(r.week)
  const wk = weekKey(now)
  await Promise.all(CODES.filter(l => l !== 'ko').map(async l => {
    const prev = await store.get<MenuDict>(menuKey(l)).catch(() => null)
    const known = prev?.tr ?? {}
    // 번역이 원문 그대로인 것(지난번 실패)도 다시 시도
    const need = names.filter(n => !Object.hasOwn(known, n) || known[n] === n)
    const out = need.length ? await translateList(need, l) : []
    const tr = { ...known, ...Object.fromEntries(need.map((n, i) => [n, out[i] || n])) }
    await store.put(menuKey(l), { weekKey: wk, builtAt: now, tr } satisfies MenuDict)
  }))
  return true
}

// ---------- 읽기(화면) ----------

const g = globalThis as typeof globalThis & { __uniPrebuiltRead?: Map<string, { at: number; v: unknown }>; __uniPrebuiltBusy?: Set<string> }
const reads = (g.__uniPrebuiltRead ??= new Map())
const busy = (g.__uniPrebuiltBusy ??= new Set())

async function readSnap<T>(store: CacheStore, key: string): Promise<T | null> {
  const hit = reads.get(key)
  if (hit && Date.now() - hit.at < READ_TTL) return hit.v as T | null
  const v = await store.get<T>(key).catch(() => null)
  reads.set(key, { at: Date.now(), v })
  return v
}

/** 다시 만들기를 응답 뒤로 미룬다(같은 인스턴스·다른 인스턴스 모두 한 번만: 메모리 표시 + 저장소 잠금) */
export function rebuildLater(job: 'notices-academic' | 'notices-general' | 'menu', store: CacheStore = getCacheStore()) {
  if (busy.has(job)) return
  busy.add(job)
  const run = async () => {
    try {
      if (!(await store.claim(job, LOCK_MS))) return
      try {
        if (job === 'menu') await buildMenu(store)
        else await buildNotices(job === 'notices-academic' ? 'academic' : 'general', store)
        for (const k of [...reads.keys()]) if (k.startsWith(job === 'menu' ? 'menu-' : job)) reads.delete(k)
      } finally {
        await store.release(job).catch(() => {})
      }
    } catch (e) {
      console.warn('[prebuilt] rebuild failed:', job, e instanceof Error ? e.message : e)
    } finally {
      busy.delete(job)
    }
  }
  try {
    after(run)
  } catch {
    // 요청 밖(테스트·스크립트)이면 그냥 돌린다
    void run()
  }
}

export type NoticeCardView = StoredCard & { isToday: boolean; dday: string | null }
const view = (c: StoredCard, now: number): NoticeCardView => ({ ...c, isToday: postedToday(c.date, now), dday: c.deadline ? dDay(c.deadline, now) : null })

/**
 * 공지 목록(저장본). 오늘 것이 아니거나 요약이 빠진 채 30분이 지났으면 뒤에서 다시 만든다.
 * 저장본이 아예 없으면(처음 배포) AI 없이 학교 사이트 목록만 원문으로 보여 준다
 */
/** status: prebuilt(오늘 저장본), stale(지난 저장본을 보여 주며 다시 만드는 중), live(저장본이 없어 원문 목록) */
export async function readNotices(board: NoticeBoard, lang: Lang, limit: number, now = Date.now(), store: CacheStore = getCacheStore()): Promise<{ items: NoticeCardView[]; source: 'live' | 'snapshot'; status: 'prebuilt' | 'stale' | 'live' }> {
  const snap = await readSnap<NoticeSnap>(store, noticeKey(board, lang))
  const old = !snap || snap.day !== kstDay(now).iso
  if (old || (snap.missing > 0 && now - snap.builtAt > RETRY_MS)) rebuildLater(board === 'academic' ? 'notices-academic' : 'notices-general', store)
  if (snap) return { items: snap.items.slice(0, limit).map(c => view(c, now)), source: snap.source, status: old ? 'stale' : 'prebuilt' }
  const { items, source } = await getNotices(board, limit)
  return { items: items.map(n => view({ ...n, titleTr: n.title, excerpt: '', images: 0, files: [], bullets: [], deadline: null, apply: null }, now)), source, status: 'live' }
}

/**
 * 지금 받은 식단 이름들의 번역(사전에서 찾기만 한다, 요청 때 AI 호출 없음). 사전에 없는 이름은 원문 그대로.
 * 사전이 이번 주 것이 아니거나, 사전에 없는 새 이름이 있는데 사전을 만든 지 1시간이 지났으면 뒤에서 새 이름만 번역한다
 * prebuilt: 사전에서 모두 찾음, partial: 일부 원문, none: 사전 없음
 */
export async function menuTranslations(lang: Lang, names: string[], now = Date.now(), store: CacheStore = getCacheStore()): Promise<{ tr: Record<string, string>; status: 'prebuilt' | 'partial' | 'none' }> {
  if (lang === 'ko') return { tr: Object.fromEntries(names.map(n => [n, n])), status: 'prebuilt' }
  const dict = await readSnap<MenuDict>(store, menuKey(lang))
  const known = dict?.tr ?? {}
  const missing = names.filter(n => !Object.hasOwn(known, n))
  if (!dict || dict.weekKey !== weekKey(now) || (missing.length > 0 && now - dict.builtAt > 60 * 60_000)) rebuildLater('menu', store)
  const tr = Object.fromEntries(names.map(n => [n, Object.hasOwn(known, n) ? known[n] : n]))
  return { tr, status: !dict ? 'none' : missing.length ? 'partial' : 'prebuilt' }
}

/** 테스트용: 인스턴스 읽기 캐시 비우기 */
export function resetPrebuiltReads() {
  reads.clear()
  busy.clear()
}

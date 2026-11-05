'use client'
// 익명 사용 통계 수집기(방문객 틀·로그인 탭 틀에 하나씩): 화면 보기·열림 시간, 언어 선택, 공지 누름·머문 시간, 도우미 버튼, 오류·실패 화면을 /api/events로 보낸다.
// 무작위 세션 id만 보내고 이름·아이디는 보내지 않는다(로그인 상태면 서버가 세션 쿠키로 계정을 붙인다). 무엇이 실패해도 화면에는 영향이 없다
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

type Ev = { kind: string } & Record<string, unknown>

const ctx = { visitor: true, lang: 'ko' }
let sid: string | null = null
const queue: Ev[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let installed = false
let lastViewKey = ''
let firstView = true
let navStart: number | null = null
let errorsSent = 0

const rand = (n = 10) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

function sessionId(): string {
  if (sid) return sid
  try { sid = localStorage.getItem('unimate.sid') } catch { /* 저장소를 못 쓰면 이 탭에서만 */ }
  if (!sid || !/^[A-Za-z0-9-]{8,64}$/.test(sid)) {
    sid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : rand(24)
    try { localStorage.setItem('unimate.sid', sid) } catch { /* 무시 */ }
  }
  return sid
}

function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  while (queue.length) {
    try {
      const body = JSON.stringify({ sid: sessionId(), events: queue.splice(0, 20) })
      const blob = new Blob([body], { type: 'application/json' })
      if (!(navigator.sendBeacon?.('/api/events', blob))) {
        void fetch('/api/events', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {})
      }
    } catch { /* 통계는 버린다 */ }
  }
}

function send(e: Ev) {
  try {
    queue.push({ visitor: ctx.visitor, lang: ctx.lang, path: location.pathname, ...e })
    if (queue.length >= 20) flush()
    else timer ??= setTimeout(flush, 1500)
  } catch { /* 무시 */ }
}

const nowMs = () => performance.now()

/* ── 공지 화면 추적: 보인 시간(탭이 보일 때만), 카드별 화면에 보인 시간, 첫 누름까지 시간 ── */
type NoticeView = {
  vid: string
  /** 이미 보고한 보인 시간(첫 누름까지 시간은 이것까지 더한다) */
  done: number
  active: number
  since: number | null
  cards: Map<Element, { board: string; id: string; total: number; since: number | null }>
  opened: Set<string>
  io: IntersectionObserver | null
}
let nv: NoticeView | null = null

const pageVisible = () => document.visibilityState === 'visible'
function activeMs(v: NoticeView) { return v.done + v.active + (v.since != null ? nowMs() - v.since : 0) }

function pauseNotices() {
  if (!nv) return
  const t = nowMs()
  if (nv.since != null) { nv.active += t - nv.since; nv.since = null }
  for (const c of nv.cards.values()) if (c.since != null) { c.total += t - c.since; c.since = null }
}

/** 지금까지의 머문 시간을 보내고 0부터 다시 센다(탭을 가리거나 화면을 떠날 때) */
function reportNotices() {
  if (!nv) return
  pauseNotices()
  if (nv.active >= 300) send({ kind: 'notice_dwell', scope: 'page', ms: Math.round(nv.active), vid: nv.vid })
  let n = 0
  for (const c of nv.cards.values()) {
    if (c.total >= 1000 && n++ < 20) send({ kind: 'notice_dwell', scope: 'notice', board: c.board, id: c.id, ms: Math.round(c.total), vid: nv.vid })
    c.total = 0
  }
  nv.done += nv.active
  nv.active = 0
}

function startNotices() {
  const v: NoticeView = { vid: rand(10), done: 0, active: 0, since: pageVisible() ? nowMs() : null, cards: new Map(), opened: new Set(), io: null }
  nv = v
  try {
    v.io = new IntersectionObserver(entries => {
      const t = nowMs()
      for (const en of entries) {
        const c = v.cards.get(en.target)
        if (!c) continue
        // 카드의 절반(카드가 화면보다 길면 화면의 절반) 이상 보이면 읽는 중으로 본다
        const seen = en.isIntersecting && en.intersectionRect.height >= Math.min(en.boundingClientRect.height, window.innerHeight) * 0.5
        if (seen && c.since == null && pageVisible()) c.since = t
        if (!seen && c.since != null) { c.total += t - c.since; c.since = null }
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
    document.querySelectorAll<HTMLElement>('[data-notice]').forEach(el => {
      const [board, id] = (el.dataset.notice ?? '').split(':')
      if (!board || !id) return
      v.cards.set(el, { board, id, total: 0, since: null })
      v.io!.observe(el)
    })
  } catch { /* IntersectionObserver가 없으면 화면 머문 시간만 */ }
}

function stopNotices() {
  if (!nv) return
  reportNotices()
  nv.io?.disconnect()
  nv = null
}

/* ── 화면 보기 ── */
function sendView(vid: string) {
  const ev: Ev = { kind: 'view', nav: firstView ? 'load' : 'spa', vid }
  if (firstView) {
    firstView = false
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav) {
      if (nav.responseStart > 0) ev.ttfb = Math.round(nav.responseStart)
      if (nav.domContentLoadedEventEnd > 0) ev.dcl = Math.round(nav.domContentLoadedEventEnd)
      if (nav.loadEventEnd > 0) ev.load = Math.round(nav.loadEventEnd)
    }
  } else if (navStart != null && nowMs() - navStart < 30_000) {
    ev.spa = Math.round(nowMs() - navStart)
  }
  navStart = null
  send(ev)
  // 눈에 보이는 실패 상태(공지 저장본, 빈 목록, 식단 오류·저장본)
  document.querySelectorAll<HTMLElement>('[data-fail]').forEach(el => send({ kind: 'fail', what: el.dataset.fail }))
}

/* ── 전역 듣개(한 번만) ── */
function install() {
  if (installed) return
  installed = true
  document.addEventListener('click', e => {
    try {
      const el = e.target instanceof Element ? e.target : null
      if (!el) return
      const a = el.closest('a')
      const href = a?.getAttribute('href') ?? ''
      if (a && href.startsWith('/') && !href.startsWith('/api/') && !a.target && !a.hasAttribute('download')) navStart = nowMs()
      const hl = a?.getAttribute('hreflang')
      if (hl && ctx.visitor) send({ kind: 'lang', picked: hl })
      const card = el.closest<HTMLElement>('[data-notice]')
      const [board, id] = (card?.dataset.notice ?? '').split(':')
      const action = el.closest<HTMLElement>('[data-track]')?.dataset.track
      if (action) send({ kind: 'action', action, ...(board && id ? { board, id } : {}) })
      if (card && board && id && nv && !nv.opened.has(`${board}:${id}`)) {
        send({ kind: 'notice_open', board, id, ms: Math.round(activeMs(nv)), first: nv.opened.size === 0, vid: nv.vid })
        nv.opened.add(`${board}:${id}`)
      }
      if (a && (a.target === '_blank' || /^https?:/.test(href))) flush()
    } catch { /* 무시 */ }
  }, { capture: true, passive: true })
  const err = (type: 'error' | 'rejection', message: string) => {
    if (errorsSent++ >= 5) return
    send({ kind: 'error', type, message: message.slice(0, 500) })
  }
  window.addEventListener('error', e => { try { err('error', String(e.message || 'error')) } catch { /* 무시 */ } })
  window.addEventListener('unhandledrejection', e => {
    try {
      const r: unknown = e.reason
      err('rejection', r instanceof Error ? `${r.name}: ${r.message}` : String(r))
    } catch { /* 무시 */ }
  })
  document.addEventListener('visibilitychange', () => {
    try {
      if (pageVisible()) {
        if (nv && nv.since == null) nv.since = nowMs()
        if (nv) {
          // 다시 보이면 이미 보이던 카드는 다음 교차 변화 때 이어 센다
          for (const c of nv.cards.values()) c.since = null
          nv.io?.disconnect()
          for (const el of nv.cards.keys()) nv.io?.observe(el)
        }
      } else {
        reportNotices()
        flush()
      }
    } catch { /* 무시 */ }
  })
  window.addEventListener('pagehide', () => { try { reportNotices(); flush() } catch { /* 무시 */ } })
}

type Props = { visitor: boolean; lang: string }

/** 정적으로 그려지는 화면에서도 useSearchParams가 빌드를 막지 않게 Suspense로 감싼다 */
export default function Tracker(props: Props) {
  return <Suspense fallback={null}><Track {...props} /></Suspense>
}

function Track({ visitor, lang }: Props) {
  const pathname = usePathname()
  // 공지 게시판(?b=)을 바꾸면 새 화면으로 센다
  const board = useSearchParams().get('b') ?? ''
  useEffect(() => {
    try {
      ctx.visitor = visitor
      ctx.lang = lang
      install()
      // 같은 화면을 두 번 세지 않게(개발 모드의 두 번 실행, 틀이 다시 그려질 때)
      const key = `${location.pathname}?${lang}&${board}`
      const isNotices = /\/notices$/.test(location.pathname)
      if (key !== lastViewKey) {
        lastViewKey = key
        const vid = rand(10)
        const go = () => sendView(vid)
        if (firstView && document.readyState !== 'complete') window.addEventListener('load', () => setTimeout(go, 0), { once: true })
        else go()
        if (isNotices) { stopNotices(); startNotices() }
      } else if (isNotices && !nv) startNotices()
      return () => { if (isNotices) stopNotices() }
    } catch { /* 무시 */ }
  }, [pathname, board, visitor, lang])
  return null
}

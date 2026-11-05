'use client'
// 실시간 이벤트를 받으면 화면 데이터를 다시 불러오는 훅(Supabase 공개 키가 있으면 broadcast, 없으면 SSE)
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
/** 서버 bus.ts의 LIVE_CHANNEL·LIVE_EVENT와 같아야 한다 */
const LIVE_CHANNEL = 'live', LIVE_EVENT = 'e'
const DEBOUNCE_MS = 300

type Listener = (topic: string) => void

/**
 * 브라우저 한 탭에 Supabase 클라이언트·채널은 하나만 두고 여러 화면 조각이 나눠 쓴다
 * (화면마다 만들면 소켓이 늘고, 한쪽이 채널을 지우면 다른 쪽 구독도 끊긴다)
 */
const shared: { sb?: SupabaseClient; channel?: RealtimeChannel; idle?: ReturnType<typeof setTimeout>; listeners: Set<Listener> } = { listeners: new Set() }
/** 마지막 구독자가 떠나도 잠깐 채널을 남겨 둔다(화면 이동 때 끊었다 다시 붙지 않게) */
const IDLE_CLOSE_MS = 5_000

function listenBroadcast(fn: Listener): () => void {
  clearTimeout(shared.idle)
  shared.listeners.add(fn)
  if (!shared.channel) {
    shared.sb ??= createClient(SB_URL!, SB_ANON!, { auth: { persistSession: false, autoRefreshToken: false } })
    shared.channel = shared.sb.channel(LIVE_CHANNEL).on('broadcast', { event: LIVE_EVENT }, ({ payload }) => {
      const topic = (payload as { topic?: unknown } | undefined)?.topic
      if (typeof topic === 'string') for (const l of shared.listeners) l(topic)
    }).subscribe()
  }
  return () => {
    shared.listeners.delete(fn)
    if (shared.listeners.size > 0) return
    clearTimeout(shared.idle)
    shared.idle = setTimeout(() => {
      if (shared.listeners.size > 0 || !shared.channel || !shared.sb) return
      void shared.sb.removeChannel(shared.channel)
      shared.channel = undefined
    }, IDLE_CLOSE_MS)
  }
}

export function useLive(topics: string[]) {
  const router = useRouter()
  // 쉼표가 든 토픽(과목명)도 안전하게 비교하도록 JSON으로 묶는다
  const key = JSON.stringify([...new Set(topics.filter(Boolean))].sort())
  useEffect(() => {
    const wanted: string[] = JSON.parse(key)
    if (wanted.length === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS)
    }

    if (SB_URL && SB_ANON) {
      const set = new Set(wanted)
      const off = listenBroadcast(topic => { if (set.has(topic)) refresh() })
      return () => { clearTimeout(timer); off() }
    }

    const qs = new URLSearchParams(wanted.map(t => ['t', t]))
    const es = new EventSource(`/api/live?${qs}`)
    // 연결이 끊겼다 다시 붙으면 그사이 놓친 이벤트가 있을 수 있어 한 번 새로 불러온다
    let dropped = false
    es.onmessage = refresh
    es.onerror = () => { dropped = true }
    es.onopen = () => { if (dropped) { dropped = false; refresh() } }
    return () => { clearTimeout(timer); es.close() }
  }, [key, router])
}

// 실시간 이벤트 발행·구독: 프로세스 안 EventEmitter(+SSE)는 항상, Supabase 모드면 broadcast 채널 "live"로도 보낸다
import { EventEmitter } from 'node:events'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { has } from '../env'
import type { LiveEvent } from '../types'

const g = globalThis as { __unimateBus?: EventEmitter; __unimateRealtime?: SupabaseClient }
const bus = (g.__unimateBus ??= new EventEmitter().setMaxListeners(0))

export const dmTopic = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`
/** 브라우저와 서버가 함께 쓰는 broadcast 채널·이벤트 이름 */
export const LIVE_CHANNEL = 'live', LIVE_EVENT = 'e'

/** 한 연결이 구독할 수 있는 토픽 수·길이 상한 */
export const MAX_TOPICS = 20, MAX_TOPIC_LEN = 200

/**
 * 이 사용자가 SSE로 들어도 되는 토픽인지. 쪽지는 두 당사자만, 친구 요청은 본인만,
 * 게시판·글·강의평가는 로그인한 누구나. 그 밖의 토픽은 받지 않는다
 */
export function canSubscribe(topic: string, userId: string): boolean {
  if (!topic || topic.length > MAX_TOPIC_LEN || /[\u0000-\u001f]/.test(topic)) return false
  if (topic.startsWith('dm:')) {
    const ids = topic.slice(3).split(':')
    return ids.length === 2 && ids.includes(userId)
  }
  if (topic.startsWith('friends:')) return topic.slice(8) === userId
  return /^(board|post|reviews):./.test(topic)
}

function emitLocal(e: LiveEvent) {
  try {
    bus.emit(e.topic, e)
  } catch (err) {
    console.warn('[publish] listener:', err instanceof Error ? err.message : err)
  }
}

/** 이벤트에는 id만 실린다(내용 없음). 실패해도 글 저장은 이미 끝났으므로 예외를 내지 않는다 */
export async function publish(e: LiveEvent): Promise<void> {
  // SSE로 붙은 브라우저(공개 Supabase 키가 없는 경우)도 받도록 프로세스 안에는 항상 낸다
  emitLocal(e)
  if (!has.db) return
  let sb: SupabaseClient
  try {
    sb = g.__unimateRealtime ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  } catch (err) {
    console.warn('[publish] client:', err instanceof Error ? err.message : err)
    return
  }
  const channel = sb.channel(LIVE_CHANNEL)
  try {
    await channel.httpSend(LIVE_EVENT, e)
  } catch (err) {
    console.warn('[publish]', err instanceof Error ? err.message : err)
  } finally {
    try {
      await sb.removeChannel(channel)
    } catch {
      // 구독하지 않은 채널이라 정리 실패는 무시해도 된다
    }
  }
}

/** 토픽들을 구독하고 해제 함수를 돌려준다(같은 토픽이 두 번 와도 한 번만 붙인다) */
export function subscribe(topics: string[], fn: (e: LiveEvent) => void): () => void {
  const unique = [...new Set(topics)]
  for (const t of unique) bus.on(t, fn)
  let done = false
  return () => {
    if (done) return
    done = true
    for (const t of unique) bus.off(t, fn)
  }
}

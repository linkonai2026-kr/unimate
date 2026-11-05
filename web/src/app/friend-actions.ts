'use server'
// 친구 요청·수락·거절과 번역 쪽지 보내기 서버 액션
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { flowDeps } from '@/lib/board/deps'
import { cleanInput, messageContext, translateLater } from '@/lib/board/flow'
import { dmTopic, publish } from '@/lib/live/bus'
import { isSuspended } from '@/lib/moderation'
import { createLimiter } from '@/lib/rate-limit'
import { getStore } from '@/lib/store'
import { cleanHandle } from '@/lib/timetable/match'

/** 쪽지 최대 길이(입력칸 maxLength와 같다) */
const MESSAGE_MAX = 1000
/** 도배 방지: 사용자당 1분에 쪽지 20개, 친구 요청·응답 30번 */
const messageAllowed = createLimiter({ limit: 20, windowMs: 60_000 })
const friendAllowed = createLimiter({ limit: 30, windowMs: 60_000 })

/** 아이디로 상대를 찾는다. 나 자신이거나 없으면 null */
async function otherByHandle(meId: string, handle: unknown) {
  const h = cleanHandle(handle)
  const other = h ? await getStore().getProfileByHandle(h) : null
  return other && other.id !== meId ? other : null
}

/** 친구 요청(상대가 이미 나에게 요청했으면 바로 친구). 상대 화면은 실시간으로 갱신 */
export async function requestFriendByHandle(handle: string) {
  const me = await requireUser()
  const other = await otherByHandle(me.id, handle)
  if (!other || !friendAllowed(me.id)) return
  const r = await getStore().requestFriend(me.id, other.id)
  if (r !== 'already') await publish({ topic: `friends:${other.id}`, kind: 'new', id: me.id })
  refresh()
}

export async function respondFriendRequest(fromHandle: string, accept: boolean) {
  const me = await requireUser()
  const from = await otherByHandle(me.id, fromHandle)
  if (!from || !friendAllowed(me.id)) return
  // 받은 요청이 있을 때만 처리한다(없는 요청을 수락해 친구가 되는 일 방지는 스토어도 지킨다)
  const { incoming } = await getStore().listRequests(me.id)
  if (incoming.some(p => p.id === from.id)) {
    await getStore().respondFriend(me.id, from.id, accept === true)
    await publish({ topic: `friends:${from.id}`, kind: 'new', id: me.id })
  }
  refresh()
}

/** 쪽지: 나 자신·없는 사람에게는 보내지 않고, 빈 글은 받지 않는다(제어 문자 제거, 1000자까지). 사용자당 횟수 제한, 이용 제한 중이면 막는다 */
export async function sendMessage(toHandle: string, f: FormData) {
  const me = await requireUser()
  const body = cleanInput(f.get('body'), MESSAGE_MAX, true)
  const d = flowDeps()
  const other = await otherByHandle(me.id, toHandle)
  if (!other) redirect('/messages')
  // 이용 제한 중이면 보내지 않고 화면을 다시 그린다(대화 화면이 입력칸 대신 제한 안내를 보여 준다)
  if (isSuspended(me)) return refresh()
  if (!body || !messageAllowed(me.id)) return
  const m = await d.store.createMessage({ fromId: me.id, toId: other.id, body, lang: me.lang })
  const topic = dmTopic(me.id, other.id)
  await d.publish({ topic, kind: 'new', id: m.id })
  translateLater(d, 'message', m.id, { body }, [topic], async () => messageContext(await d.store.listMessages(me.id, other.id), m))
  redirect(`/messages/${other.handle}`)
}

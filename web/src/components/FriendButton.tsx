// 친구 관계에 맞는 버튼: 요청 보내기 / 요청됨(회색) / 받은 요청이면 수락 / 이미 친구면 아무것도 없음
import { Check, Plus, UserPlus } from '@phosphor-icons/react/dist/ssr'
import { requestFriendByHandle, respondFriendRequest } from '@/app/friend-actions'
import { btn } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'

export type Relation = 'friend' | 'sent' | 'incoming' | 'none'

/** 친구 목록과 요청 목록으로 상대와의 관계를 구한다(서로 요청이 엇갈렸으면 받은 요청이 먼저) */
export function relationOf(id: string, friendIds: Set<string>, req: { incoming: { id: string }[]; outgoing: string[] }): Relation {
  if (friendIds.has(id)) return 'friend'
  if (req.incoming.some(p => p.id === id)) return 'incoming'
  return req.outgoing.includes(id) ? 'sent' : 'none'
}

export default function FriendButton({ handle, rel, lang, size = 'icon' }: { handle: string; rel: Relation; lang: Lang; size?: 'icon' | 'small' | 'big' }) {
  if (rel === 'friend') return null
  if (rel === 'incoming') return (
    <form action={respondFriendRequest.bind(null, handle, true)}>
      <button className={size === 'big' ? btn.primary : btn.smallPrimary}><Check size={size === 'big' ? 20 : 16} weight="bold" aria-hidden />{t(lang, 'acceptFriend')}</button>
    </form>
  )
  if (rel === 'sent') return size === 'big'
    ? <span role="status" className={`${btn.soft} h-14 text-muted`}>{t(lang, 'requestSent')}</span>
    : <span role="status" className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-xl bg-bg-soft px-3 text-[13px] font-semibold text-muted">{t(lang, 'requestSent')}</span>
  return (
    <form action={requestFriendByHandle.bind(null, handle)}>
      {size === 'icon' && <button aria-label={t(lang, 'addFriend')} className="press flex h-11 w-11 items-center justify-center rounded-xl bg-teal text-white"><Plus size={20} weight="bold" aria-hidden /></button>}
      {size === 'small' && <button className={btn.smallPrimary}>{t(lang, 'addFriend')}</button>}
      {size === 'big' && <button className={btn.primary}><UserPlus size={20} weight="bold" aria-hidden />{t(lang, 'addFriend')}</button>}
    </form>
  )
}

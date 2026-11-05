// QR로 들어온 친구 추가 확인 화면(?h=아이디)
import { UserPlus } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import FriendButton, { relationOf } from '@/components/FriendButton'
import { BottomCTA, Empty, Flag, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'
import { cleanHandle } from '@/lib/timetable/match'

export default async function AddFriendPage({ searchParams }: PageProps<'/friends/add'>) {
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const handle = cleanHandle((await searchParams).h)
  const other = handle ? await store.getProfileByHandle(handle) : null
  if (!other || other.id === me.id) return <Empty icon={<UserPlus size={28} />} title={t(lang, 'notFound')} action={<Link href="/friends" className={btn.primary}>{t(lang, 'friends')}</Link>} />
  const [friends, req] = await Promise.all([store.listFriends(me.id), store.listRequests(me.id)])
  const rel = relationOf(other.id, new Set(friends.map(f => f.id)), req)
  return (
    <div className="rise flex flex-col items-center gap-3 px-6 pb-40 pt-16 text-center">
      <Avatar n={other.avatar ?? 0} photo={other.photo} size={88} />
      <p className="mt-2 flex items-center gap-2 text-[22px] font-bold">{other.nickname}<Flag code={other.nationality} size={16} /></p>
      <p className="text-[17px] text-muted">{t(lang, 'addThisFriend', { name: other.nickname })}</p>
      <p className="text-[14px] text-[#8b93a1]">{t(lang, 'requestHint')}</p>
      <BottomCTA>
        {rel === 'friend'
          ? <Link href={`/friends/${other.handle}`} className={btn.soft}>{t(lang, 'alreadyFriend')}</Link>
          : <FriendButton handle={other.handle} rel={rel} lang={lang} size="big" />}
      </BottomCTA>
    </div>
  )
}

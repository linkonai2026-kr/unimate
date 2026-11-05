// 친구 시간표: 내 공강과 겹치는 시간을 점선으로, 친구 추가·쪽지. 친구가 아니면 수업 칸은 숨기고 겹치는 공강만
import { ChatsCircle, LockSimple } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Avatar from '@/components/Avatar'
import FriendButton, { relationOf } from '@/components/FriendButton'
import TimetableGrid from '@/components/TimetableGrid'
import { Flag, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'
import { cleanHandle, freeMask, overlapRanges } from '@/lib/timetable/match'
import { busyMask } from '@/lib/timetable/slots'

export default async function FriendPage({ params }: PageProps<'/friends/[handle]'>) {
  const me = await requireUser()
  const lang = me.lang
  const handle = cleanHandle((await params).handle)
  const store = getStore()
  const other = handle ? await store.getProfileByHandle(handle) : null
  if (!other) notFound()
  // 내 프로필이면 내 시간표 화면으로
  if (other.id === me.id) redirect('/timetable')
  const [friends, req, mine] = await Promise.all([store.listFriends(me.id), store.listRequests(me.id), store.listCourses(me.id)])
  const rel = relationOf(other.id, new Set(friends.map(f => f.id)), req)
  const isFriend = rel === 'friend'
  const theirs = await store.listCourses(other.id)
  const free = mine.length && theirs.length ? overlapRanges(freeMask(busyMask(mine)), freeMask(busyMask(theirs))) : []
  return (
    <div className="space-y-3 pb-6 pt-1">
      <section className="rise card mx-3 flex items-center gap-3 p-5">
        <Avatar n={other.avatar ?? 0} photo={other.photo} size={52} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[19px] font-bold">{other.nickname}<Flag code={other.nationality} size={13} /></p>
          <p className="text-[14px] text-muted">@{other.handle}</p>
        </div>
      </section>
      <div className={`mx-3 grid gap-2 ${isFriend ? '' : 'grid-cols-2'}`}>
        {!isFriend && <FriendButton handle={other.handle} rel={rel} lang={lang} size="big" />}
        <Link href={`/messages/${other.handle}`} className={btn.mint}><ChatsCircle size={20} weight="fill" aria-hidden />{t(lang, 'sendMessage')}</Link>
      </div>
      <div className="rise mx-3">
        <p className="mb-2 px-2 text-[17px] font-bold">{t(lang, 'timetableOf', { name: other.nickname })}</p>
        {!isFriend && <p className="mb-2 flex items-center gap-1.5 px-2 text-[13px] font-medium text-muted"><LockSimple size={14} weight="bold" aria-hidden />{t(lang, 'friendsOnlyTimetable')}</p>}
        {free.length > 0 && <p className="mb-2 flex items-center gap-1.5 px-2 text-[13px] font-semibold text-teal"><span className="h-3 w-5 rounded border-2 border-dashed border-mint bg-mint/15" aria-hidden />{t(lang, 'freeOverlap')}</p>}
        <TimetableGrid lang={lang} courses={isFriend ? theirs.map(c => ({ key: c.id, name: c.name, place: c.place, day: c.day, start: c.start, end: c.end })) : []} free={free} />
      </div>
    </div>
  )
}

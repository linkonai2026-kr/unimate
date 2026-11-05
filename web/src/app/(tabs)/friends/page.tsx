// 친구: 내 QR·쪽지함, 받은 친구 요청(수락·거절), 같은 수업 듣는 사람·공강이 겹치는 추천, 아이디로 찾기, 내 친구
import { BookOpen, ChatsCircle, Clock, MagnifyingGlass, QrCode, UsersThree } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { respondFriendRequest } from '@/app/friend-actions'
import Avatar from '@/components/Avatar'
import FriendButton, { relationOf } from '@/components/FriendButton'
import LiveRefresh from '@/components/LiveRefresh'
import MyQr from '@/components/MyQr'
import { Empty, Flag, IconBox, Section, Sheet, btn, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { LANGS, t } from '@/lib/i18n'
import { getStore } from '@/lib/store'
import type { Profile } from '@/lib/types'
import { cleanHandle, formatRange, rankMatches, sameClassMatches } from '@/lib/timetable/match'

const langLabel = (l: string) => LANGS.find(x => x.code === l)?.label ?? l

/** 추천 줄: 프로필(누르면 친구 시간표) + 관계 버튼 */
function Person({ p, children, action }: { p: Profile; children: ReactNode; action: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Link href={`/friends/${p.handle}`} className="press flex min-w-0 flex-1 items-center gap-3">
        <Avatar n={p.avatar ?? 0} photo={p.photo} size={44} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[16px] font-bold"><span className="truncate">{p.nickname}</span><Flag code={p.nationality} size={12} /><span className="text-[12px] font-medium text-muted">{langLabel(p.lang)}</span></span>
          {children}
        </span>
      </Link>
      {action}
    </li>
  )
}

export default async function FriendsPage({ searchParams }: PageProps<'/friends'>) {
  const me = await requireUser()
  const lang = me.lang
  const sp = await searchParams
  const store = getStore()
  const [friends, profiles, myCourses, req] = await Promise.all([store.listFriends(me.id), store.listProfiles(), store.listCourses(me.id), store.listRequests(me.id)])
  const friendIds = new Set(friends.map(f => f.id))
  // 추천 후보(나·이미 친구 제외)의 시간표만 읽는다. 내 시간표가 비어 있으면 읽을 필요가 없다
  const others = myCourses.length
    ? await Promise.all(profiles.filter(p => p.id !== me.id && !friendIds.has(p.id)).map(async p => ({ profile: p, courses: await store.listCourses(p.id) })))
    : []
  const matches = rankMatches(me, myCourses, others, friendIds)
  const classmates = sameClassMatches(me, myCourses, others, friendIds)
  const rel = (id: string) => relationOf(id, friendIds, req)
  const rawQ = typeof sp.q === 'string' ? sp.q.trim().slice(0, 40) : ''
  const handle = cleanHandle(rawQ)
  const found = handle ? await store.getProfileByHandle(handle) : null
  const upload = <Link href="/timetable/import" className={btn.primary}>{t(lang, 'uploadTimetable')}</Link>

  return (
    <div className="space-y-3 pb-6 pt-1">
      <LiveRefresh topics={[`friends:${me.id}`]} />
      <div className="rise mx-3 grid grid-cols-2 gap-2">
        <Link href="/friends?qr=1" scroll={false} className="press flex h-14 min-w-0 items-center justify-center gap-2 rounded-2xl bg-navy px-2 text-[16px] font-bold text-white"><QrCode size={22} weight="bold" aria-hidden />{t(lang, 'myQr')}</Link>
        <Link href="/messages" className="press flex h-14 min-w-0 items-center justify-center gap-2 rounded-2xl bg-bg px-2 text-[16px] font-bold"><ChatsCircle size={22} weight="fill" className="text-teal" aria-hidden />{t(lang, 'messages')}</Link>
      </div>

      {req.incoming.length > 0 && (
        <Section title={<span>{t(lang, 'friendRequests')} <span className="text-[15px] font-medium text-teal">{req.incoming.length}</span></span>}>
          <ul className="pb-2">
            {req.incoming.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <Link href={`/friends/${p.handle}`} className="press flex min-w-0 flex-1 items-center gap-3">
                  <Avatar n={p.avatar ?? 0} photo={p.photo} size={44} />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 text-[16px] font-bold"><span className="truncate">{p.nickname}</span><Flag code={p.nationality} size={12} /></span><span className="block truncate text-[13px] text-muted">@{p.handle}</span></span>
                </Link>
                {/* 좁은 화면에서 거절·수락 버튼은 이름 아래 한 줄(아바타 폭만큼 들여쓰기)에 반반으로 */}
                <div className="flex w-full gap-2 pl-14 [&>form]:flex-1 [&_button]:w-full">
                  <form action={respondFriendRequest.bind(null, p.handle, false)}><button className={btn.small}>{t(lang, 'declineFriend')}</button></form>
                  <FriendButton handle={p.handle} rel="incoming" lang={lang} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t(lang, 'sameClass')}>
        {classmates.length === 0
          ? <Empty icon={<BookOpen size={28} />} title={t(lang, 'noSameClass')} action={myCourses.length ? undefined : upload} />
          : (
            <ul className="pb-2">
              {classmates.map(m => (
                <Person key={m.profile.id} p={m.profile} action={<FriendButton handle={m.profile.handle} rel={rel(m.profile.id)} lang={lang} />}>
                  <span className="block text-[13px] font-semibold text-teal">{t(lang, 'sameClassN', { n: String(m.shared.length) })}</span>
                  <span className="block truncate text-[13px] text-muted">{m.shared.join(' · ')}</span>
                </Person>
              ))}
            </ul>
          )}
      </Section>

      <Section title={t(lang, 'freeTogether')}>
        {matches.length === 0
          ? <Empty icon={<Clock size={28} />} title={t(lang, 'noMatches')} action={myCourses.length ? undefined : upload} />
          : (
            <ul className="pb-2">
              {matches.map(m => (
                <Person key={m.profile.id} p={m.profile} action={<FriendButton handle={m.profile.handle} rel={rel(m.profile.id)} lang={lang} />}>
                  <span className="block text-[13px] font-semibold text-teal">{t(lang, 'freeOverlap')} {t(lang, 'hours', { n: String(Math.round(m.minutes / 6) / 10) })}</span>
                  <span className="block truncate text-[13px] text-muted">{m.ranges.slice(0, 2).map(r => formatRange(r, lang)).join(' · ')}</span>
                </Person>
              ))}
            </ul>
          )}
      </Section>

      <Section title={t(lang, 'findById')}>
        <form role="search" className="flex gap-2 px-5 pb-4 pt-2">
          <label className="relative flex-1">
            <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={rawQ} maxLength={40} aria-label={t(lang, 'handle')} placeholder={t(lang, 'handle')} autoCapitalize="none" autoComplete="off" spellCheck={false} enterKeyHint="search" inputMode="search" className={`${field} h-12 pl-11`} />
          </label>
          <button className={`${btn.smallPrimary} h-12 rounded-2xl px-4`}>{t(lang, 'search')}</button>
        </form>
        {rawQ && (found && found.id !== me.id
          ? <div className="flex items-center gap-3 px-5 pb-4">
              <Link href={`/friends/${found.handle}`} className="press flex min-w-0 flex-1 items-center gap-3">
                <Avatar n={found.avatar ?? 0} photo={found.photo} size={40} />
                <span className="min-w-0"><span className="flex items-center gap-1.5 font-bold"><span className="truncate">{found.nickname}</span><Flag code={found.nationality} size={12} /></span><span className="block text-[13px] text-muted">@{found.handle}</span></span>
              </Link>
              {friendIds.has(found.id)
                ? <span className="text-[13px] text-muted">{t(lang, 'alreadyFriend')}</span>
                : <FriendButton handle={found.handle} rel={rel(found.id)} lang={lang} size="small" />}
            </div>
          : <p role="status" className="px-5 pb-4 text-[14px] text-muted">{t(lang, 'notFound')}</p>)}
      </Section>

      <Section title={<span>{t(lang, 'myFriends')} <span className="text-[15px] font-medium text-muted">{friends.length}</span></span>}>
        {friends.length === 0 ? <Empty icon={<UsersThree size={28} />} title={t(lang, 'noData')} /> : (
          <ul className="pb-2">
            {friends.map(f => (
              <li key={f.id} className="flex items-center gap-2 pr-4">
                <Link href={`/friends/${f.handle}`} className="tap flex min-w-0 flex-1 items-center gap-3 py-3 pl-5">
                  <Avatar n={f.avatar ?? 0} photo={f.photo} size={40} />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 text-[16px] font-medium"><span className="truncate">{f.nickname}</span><Flag code={f.nationality} size={12} /></span><span className="block text-[13px] text-muted">@{f.handle}</span></span>
                </Link>
                <Link href={`/messages/${f.handle}`} aria-label={t(lang, 'sendMessage')} className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-soft text-teal"><ChatsCircle size={20} weight="fill" aria-hidden /></Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {sp.qr === '1' && (
        <Sheet close="/friends">
          <div className="flex flex-col items-center gap-3 text-center">
            <IconBox tone="navy" size={52}><QrCode size={28} weight="bold" /></IconBox>
            <p className="flex items-center gap-1.5 text-[20px] font-bold">{me.nickname}<Flag code={me.nationality} size={14} /></p>
            <p className="-mt-2 text-[14px] text-muted">@{me.handle}</p>
            <MyQr handle={me.handle} />
            <p className="text-[14px] text-muted">{t(lang, 'scanQr')}</p>
          </div>
        </Sheet>
      )}
    </div>
  )
}

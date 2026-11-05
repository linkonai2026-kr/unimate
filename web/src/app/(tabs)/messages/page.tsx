// 쪽지함: 맨 위 "새 쪽지"(친구 고르기 시트), 대화 상대별 마지막 쪽지(사용자 언어로)
import { ChatsCircle, NotePencil, UserPlus } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import { Empty, Flag, Row, Sheet, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'
import { pickText } from '@/lib/text'
import { timeAgo } from '@/lib/time'

export default async function MessagesPage({ searchParams }: PageProps<'/messages'>) {
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const picking = (await searchParams).new === '1'
  const [threads, friends] = await Promise.all([store.listThreads(me.id), picking ? store.listFriends(me.id) : []])
  return (
    <div className="space-y-3 pb-6 pt-1">
      <div className="mx-3"><Link href="/messages?new=1" scroll={false} className={btn.primary}><NotePencil size={20} weight="bold" aria-hidden />{t(lang, 'newMessage')}</Link></div>
      <div className="rise card mx-3 overflow-hidden">
        {threads.length === 0 ? <Empty icon={<ChatsCircle size={28} />} title={t(lang, 'noData')} action={<Link href="/friends" className={btn.primary}>{t(lang, 'friends')}</Link>} /> : (
          <ul className="py-2">
            {threads.map(({ other, last }) => (
              <li key={other.id}>
                <Link href={`/messages/${other.handle}`} className="tap flex items-center gap-3 px-5 py-3">
                  <Avatar n={other.avatar ?? 0} photo={other.photo} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[16px] font-bold">{other.nickname}<Flag code={other.nationality} size={12} /></span>
                    {/* 내가 보낸 마지막 쪽지는 내가 쓴 그대로 */}
                    <span className="mt-0.5 block truncate text-[14px] text-muted">{last.fromId === me.id ? last.body : pickText(last, 'body', last.body, lang).text}</span>
                  </span>
                  <span className="shrink-0 self-start pt-1 text-[12px] text-[#8b93a1]">{timeAgo(last.createdAt, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {picking && (
        <Sheet close="/messages">
          <p className="px-1 pb-2 text-[19px] font-bold">{t(lang, 'pickFriendToMessage')}</p>
          {friends.length === 0
            ? <Empty icon={<UserPlus size={28} />} title={t(lang, 'noFriendsYet')} action={<Link href="/friends" className={btn.primary}>{t(lang, 'addFriend')}</Link>} />
            : <ul className="-mx-5 max-h-[50dvh] overflow-y-auto">{friends.map(f => <li key={f.id}><Row href={`/messages/${f.handle}`} icon={<Avatar n={f.avatar ?? 0} photo={f.photo} size={40} />} title={<span className="flex items-center gap-1.5">{f.nickname}<Flag code={f.nationality} size={12} /></span>} sub={`@${f.handle}`} /></li>)}</ul>}
        </Sheet>
      )}
    </div>
  )
}

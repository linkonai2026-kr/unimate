// 1:1 쪽지 대화(상대 언어로 번역, 실시간 갱신), 아래 고정 입력(이용 제한 중이면 입력 대신 제한 안내)
import { PaperPlaneRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sendMessage } from '@/app/friend-actions'
import Avatar from '@/components/Avatar'
import LiveRefresh from '@/components/LiveRefresh'
import ScrollToEnd from '@/components/ScrollToEnd'
import TrText from '@/components/TrText'
import { Flag, SanctionBanner } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { isPending } from '@/lib/board/flow'
import { t } from '@/lib/i18n'
import { isSuspended, sanctionStatus } from '@/lib/moderation'
import { dmTopic } from '@/lib/live/bus'
import { getStore } from '@/lib/store'
import { pickText } from '@/lib/text'
import { timeAgo } from '@/lib/time'
import { cleanHandle } from '@/lib/timetable/match'

export default async function ChatPage({ params }: PageProps<'/messages/[handle]'>) {
  const me = await requireUser()
  const lang = me.lang
  const handle = cleanHandle((await params).handle)
  const store = getStore()
  const other = handle ? await store.getProfileByHandle(handle) : null
  // 없는 사람·나 자신과는 대화할 수 없다
  if (!other || other.id === me.id) notFound()
  const msgs = await store.listMessages(me.id, other.id)
  return (
    <div className="pb-36">
      <LiveRefresh topics={[dmTopic(me.id, other.id)]} />
      <Link href={`/friends/${other.handle}`} className="tap sticky top-14 z-10 flex items-center gap-2.5 bg-bg-soft/95 px-5 py-2 backdrop-blur">
        <Avatar n={other.avatar ?? 0} photo={other.photo} size={32} />
        <span className="flex min-w-0 items-center gap-1.5 text-[16px] font-bold"><span className="truncate">{other.nickname}</span><Flag code={other.nationality} size={12} /></span>
      </Link>
      <ul className="space-y-3 px-4 pt-2" aria-live="polite">
        {msgs.map(m => {
          const mine = m.fromId === me.id
          const p = pickText(m, 'body', m.body, lang)
          return (
            <li key={m.id} className={`rise flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[78%] rounded-[20px] px-4 py-2.5 text-[16px] leading-relaxed ${mine ? 'rounded-br-md bg-navy text-white' : 'rounded-bl-md bg-bg'}`}>
                {mine
                  ? <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  : <TrText text={p.text} original={m.body} translated={p.translated} pending={lang !== m.lang && isPending(m)} from={m.lang} viewer={lang} />}
              </div>
              <span className="mt-1 px-1 text-[12px] text-[#8b93a1]">{timeAgo(m.createdAt, lang)}</span>
            </li>
          )
        })}
      </ul>
      {/* 처음 열면 가장 새 쪽지로, 새 쪽지가 오면 아래를 보고 있던 경우에만 따라 내려간다 */}
      <ScrollToEnd n={msgs.length} />
      {isSuspended(me) ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-[480px] bg-bg-soft/95 pb-3 pt-2 backdrop-blur"><SanctionBanner lang={lang} status={sanctionStatus(me)} /></div>
      ) : (
        <form action={sendMessage.bind(null, other.handle)} className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-[480px] items-center gap-2 bg-bg-soft/95 px-3 pb-3 pt-2 backdrop-blur">
          <input name="body" required maxLength={1000} autoComplete="off" enterKeyHint="send" aria-label={t(lang, 'messagePlaceholder')} placeholder={t(lang, 'messagePlaceholder')} className="h-12 min-w-0 flex-1 rounded-2xl bg-bg px-4 text-[16px] outline-none placeholder:text-[#a4abb8] focus:ring-2 focus:ring-navy/20" />
          <button aria-label={t(lang, 'submit')} className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white"><PaperPlaneRight size={20} weight="fill" aria-hidden /></button>
        </form>
      )}
    </div>
  )
}

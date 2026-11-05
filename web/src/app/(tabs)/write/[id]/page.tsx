// 글쓰기: 제목·본문(어떤 언어로 써도 번역됨), 사진 4장, 익명 체크, 아래 큰 등록 버튼. 경고·이용 제한 안내(제한 중이면 등록 버튼을 막는다)
import { notFound } from 'next/navigation'
import { submitPost } from '@/app/board-actions'
import ImagePicker from '@/components/ImagePicker'
import { BottomCTA, SanctionBanner, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { loadBoards } from '@/lib/board/list'
import { t } from '@/lib/i18n'
import { isSuspended, sanctionStatus } from '@/lib/moderation'
import { getStore } from '@/lib/store'

export default async function WritePage({ params }: PageProps<'/write/[id]'>) {
  const { id } = await params
  const me = await requireUser()
  const lang = me.lang
  const board = (await loadBoards(getStore(), lang)).find(b => b.id === id)
  if (!board) notFound()
  const anonOnly = !!board.anonOnly
  const suspended = isSuspended(me)
  return (
    <form action={submitPost.bind(null, board.id)} className="space-y-3 pb-40">
      <SanctionBanner lang={lang} status={sanctionStatus(me)} />
      <div className="rise card mx-3 space-y-4 p-5">
        <p className="text-[14px] font-semibold text-teal">{board.name}</p>
        {/* 제목은 길어지면 줄이 늘어나는 한 줄 textarea(서버에서 줄바꿈은 한 줄로 정리) */}
        <textarea name="title" required maxLength={100} rows={1} autoComplete="off" enterKeyHint="next" aria-label={t(lang, 'title')} placeholder={t(lang, 'title')} className="field-sizing-content w-full resize-none text-[22px] font-bold leading-snug tracking-tight outline-none placeholder:text-[#c4c9d2]" />
        <textarea name="body" required maxLength={5000} aria-label={t(lang, 'bodyPlaceholder')} placeholder={t(lang, 'bodyPlaceholder')} className="field-sizing-content min-h-[40dvh] w-full resize-none text-[16px] leading-relaxed outline-none placeholder:text-[#a4abb8]" />
        <ImagePicker lang={lang} />
      </div>
      <BottomCTA>
        {/* 비밀게시판은 항상 익명(체크를 풀 수 없음, 서버도 강제) */}
        <label className="mb-2 flex min-h-11 items-center gap-2 px-1 text-[15px] font-medium">
          <input type="checkbox" name="anonymous" defaultChecked disabled={anonOnly} className="h-5 w-5 accent-[var(--teal)]" />{t(lang, 'anonymous')}
        </label>
        <button disabled={suspended} className={btn.primary}>{t(lang, 'submit')}</button>
      </BottomCTA>
    </form>
  )
}

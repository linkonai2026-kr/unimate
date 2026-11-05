// 글 수정: 쓴 사람만. 제목·본문을 고치면 다시 번역된다(사진·익명 여부는 그대로). 가려진 글은 고칠 수 없다
import { notFound, redirect } from 'next/navigation'
import { editPost } from '@/app/board-actions'
import { BottomCTA, SanctionBanner, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { loadBoards } from '@/lib/board/list'
import { t } from '@/lib/i18n'
import { isSuspended, sanctionStatus } from '@/lib/moderation'
import { getStore } from '@/lib/store'

export default async function EditPostPage({ params }: PageProps<'/post/[id]/edit'>) {
  const { id } = await params
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const post = await store.getPost(id)
  if (!post) notFound()
  const self = `/post/${encodeURIComponent(post.id)}`
  if (post.authorId !== me.id || post.hidden) redirect(self)
  const board = (await loadBoards(store, lang)).find(b => b.id === post.board)
  return (
    <form action={editPost.bind(null, post.id)} className="space-y-3 pb-40">
      <SanctionBanner lang={lang} status={sanctionStatus(me)} />
      <div className="rise card mx-3 space-y-4 p-5">
        <p className="text-[14px] font-semibold text-teal">{t(lang, 'editPost')}{board && <span className="text-muted"> · {board.name}</span>}</p>
        <textarea name="title" required maxLength={100} rows={1} defaultValue={post.title} autoComplete="off" enterKeyHint="next" aria-label={t(lang, 'title')} placeholder={t(lang, 'title')} className="field-sizing-content w-full resize-none text-[22px] font-bold leading-snug tracking-tight outline-none placeholder:text-[#c4c9d2]" />
        <textarea name="body" required maxLength={5000} defaultValue={post.body} aria-label={t(lang, 'bodyPlaceholder')} placeholder={t(lang, 'bodyPlaceholder')} className="field-sizing-content min-h-[40dvh] w-full resize-none text-[16px] leading-relaxed outline-none placeholder:text-[#a4abb8]" />
      </div>
      <BottomCTA>
        <button disabled={isSuspended(me)} className={btn.primary}>{t(lang, 'save')}</button>
      </BottomCTA>
    </form>
  )
}

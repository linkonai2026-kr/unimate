// 글 상세: 작성자, 번역된 본문·사진, 공감·스크랩, 익명 번호 댓글·대댓글, 아래 고정 댓글 입력
import { ArrowBendDownRight, BookmarkSimple, ChatCircle, Heart as HeartIcon, PaperPlaneRight, PaperPlaneTilt, Trash } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { like, removePost, scrap, submitComment } from '@/app/board-actions'
import Avatar from '@/components/Avatar'
import LiveRefresh from '@/components/LiveRefresh'
import TrText from '@/components/TrText'
import { Flag, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { loadBoards } from '@/lib/board/list'
import { anonNumbers, toCommentView, toPostView, type CommentView } from '@/lib/board/flow'
import { t, type Lang } from '@/lib/i18n'
import { getStore } from '@/lib/store'
import { timeAgo } from '@/lib/time'
import type { Profile } from '@/lib/types'

export default async function PostPage({ params, searchParams }: PageProps<'/post/[id]'>) {
  const { id } = await params
  const reply = (await searchParams).reply
  const replyTo = typeof reply === 'string' && reply ? reply : null
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const post = await store.getPost(id)
  if (!post) notFound()

  // 같은 사람의 프로필은 한 번만 읽는다
  const profiles = new Map<string, Promise<Profile | null>>()
  const profileOf = (uid: string) => {
    let p = profiles.get(uid)
    if (!p) profiles.set(uid, (p = store.getProfile(uid)))
    return p
  }
  const [comments, boards, author] = await Promise.all([store.listComments(post.id), loadBoards(store, lang), profileOf(post.authorId)])
  const board = boards.find(b => b.id === post.board)
  const anonOnly = !!board?.anonOnly
  const p = toPostView(post, { viewer: lang, viewerId: me.id, author, comments: comments.length })
  const nums = anonNumbers(post.authorId, comments)
  const cs = await Promise.all(comments.map(async c => toCommentView(c, {
    viewer: lang, viewerId: me.id, author: await profileOf(c.authorId),
    isPostAuthor: c.authorId === post.authorId, anonNo: nums.get(c.authorId),
  })))
  const roots = cs.filter(c => !c.parentId)
  const replies = new Map<string, CommentView[]>()
  for (const c of cs) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c])
  const replyTarget = replyTo ? roots.find(c => c.id === replyTo) : undefined
  const mine = post.authorId === me.id

  return (
    <div className="space-y-3 pb-40 pt-1">
      <LiveRefresh topics={[`post:${post.id}`]} />
      <article className="rise card mx-3 p-5">
        <Link href={`/board/${encodeURIComponent(post.board)}`} className="text-[13px] font-semibold text-teal">{board?.name ?? post.board}</Link>
        <div className="mt-3 flex items-center gap-3">
          <Avatar n={p.avatar} photo={p.photo} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[15px] font-bold"><Flag code={p.nation} size={12} />{p.author}</p>
            <p className="text-[13px] text-[#8b93a1]">{timeAgo(p.createdAt, lang)}</p>
          </div>
          {mine && <form action={removePost.bind(null, post.id)}><button className={btn.small}><Trash size={16} aria-hidden />{t(lang, 'delete')}</button></form>}
          {!mine && !post.anonymous && author && <Link href={`/messages/${encodeURIComponent(author.handle)}`} className={btn.small}><PaperPlaneTilt size={16} aria-hidden />{t(lang, 'messages')}</Link>}
        </div>
        <h1 className="mt-5 text-[22px] font-bold leading-snug tracking-tight">{p.title}</h1>
        <div className="mt-3 text-[16px] leading-relaxed">
          <TrText text={p.body} original={p.originalBody} translated={p.translated} pending={p.pending} from={p.from} viewer={lang} />
        </div>
        {p.images.length > 0 && (
          <div className="mt-4 space-y-2">
            {p.images.map(img => {
              const src = `/api/img/${encodeURIComponent(img)}`
              return (
                <a key={img} href={src} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" className="w-full rounded-2xl" />
                </a>
              )
            })}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          {/* 원하는 상태를 함께 보내 두 번 눌려도 공감·스크랩이 되돌아가지 않는다 */}
          <form action={like.bind(null, 'post', post.id, !p.liked)} className="flex-1">
            <button aria-pressed={p.liked} className={`press flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold ${p.liked ? 'bg-danger/10 text-danger' : 'bg-bg-soft text-ink'}`}>
              <HeartIcon size={18} weight={p.liked ? 'fill' : 'regular'} aria-hidden />{t(lang, 'like')} {p.likes || ''}
            </button>
          </form>
          <form action={scrap.bind(null, post.id, !p.scraped)} className="flex-1">
            <button aria-pressed={p.scraped} className={`press flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold ${p.scraped ? 'bg-star/15 text-[#b07f00]' : 'bg-bg-soft text-ink'}`}>
              <BookmarkSimple size={18} weight={p.scraped ? 'fill' : 'regular'} aria-hidden />{t(lang, 'scrap')} {p.scraps || ''}
            </button>
          </form>
        </div>
      </article>

      <section className="rise card mx-3 overflow-hidden">
        <h2 className="flex items-center gap-1.5 px-5 pt-5 text-[17px] font-bold"><ChatCircle size={20} weight="fill" className="text-teal" aria-hidden />{t(lang, 'comment')} {cs.length}</h2>
        <ul className="pb-2 pt-1">
          {roots.map(c => (
            <li key={c.id}>
              <CommentRow c={c} lang={lang} postId={post.id} />
              {(replies.get(c.id) ?? []).map(r => (
                <div key={r.id} className="flex gap-1 pl-5 pr-3">
                  <ArrowBendDownRight size={16} className="mt-4 shrink-0 text-[#c4c9d2]" aria-hidden />
                  <div className="mb-2 flex-1 rounded-2xl bg-bg-soft"><CommentRow c={r} lang={lang} postId={post.id} reply /></div>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <form action={submitComment.bind(null, post.id)} className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-[480px] bg-bg/95 px-3 pb-3 pt-2 backdrop-blur">
        {replyTarget && (
          <p className="mb-1.5 flex items-center justify-between px-2 text-[13px] font-medium text-teal">
            <span className="flex min-w-0 items-center gap-1"><ArrowBendDownRight size={14} aria-hidden /><span className="truncate">{t(lang, 'replyingTo')}: {replyTarget.body.slice(0, 30)}</span></span>
            <Link href={`/post/${encodeURIComponent(post.id)}`} scroll={false} className="text-muted">{t(lang, 'cancel')}</Link>
          </p>
        )}
        <input type="hidden" name="parentId" value={replyTarget?.id ?? ''} />
        <div className="flex items-center gap-2 rounded-2xl bg-bg-soft py-1.5 pl-3 pr-1.5">
          {/* 비밀게시판은 항상 익명(체크를 풀 수 없음, 서버도 강제) */}
          <label className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-teal"><input type="checkbox" name="anonymous" defaultChecked disabled={anonOnly} className="h-4 w-4 accent-[var(--teal)]" />{t(lang, 'anonymous')}</label>
          <input name="body" required maxLength={2000} autoComplete="off" aria-label={t(lang, 'comment')} placeholder={t(lang, 'commentPlaceholder')} className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-[#a4abb8]" />
          <button aria-label={t(lang, 'submit')} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><PaperPlaneRight size={18} weight="fill" aria-hidden /></button>
        </div>
      </form>
    </div>
  )
}

function CommentRow({ c, lang, postId, reply }: { c: CommentView; lang: Lang; postId: string; reply?: boolean }) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-2">
        <Avatar n={c.avatar} photo={c.photo} size={28} />
        <span className={`flex flex-1 items-center gap-1.5 text-[14px] font-bold ${c.isPostAuthor ? 'text-teal' : ''}`}><Flag code={c.nation} size={11} />{c.author}</span>
        <span className="flex items-center gap-1">
          {!reply && <Link href={`/post/${encodeURIComponent(postId)}?reply=${encodeURIComponent(c.id)}`} scroll={false} className="press rounded-lg px-2 py-1 text-[12px] font-medium text-muted">{t(lang, 'reply')}</Link>}
          <form action={like.bind(null, 'comment', c.id, !c.liked)}><button aria-label={t(lang, 'like')} aria-pressed={c.liked} className={`press flex items-center gap-0.5 rounded-lg px-2 py-1 text-[12px] font-semibold ${c.liked ? 'text-danger' : 'text-muted'}`}><HeartIcon size={14} weight={c.liked ? 'fill' : 'regular'} aria-hidden />{c.likes || ''}</button></form>
        </span>
      </div>
      <div className="mt-1.5 pl-9 text-[15px] leading-relaxed"><TrText text={c.body} original={c.originalBody} translated={c.translated} pending={c.pending} from={c.from} viewer={lang} /></div>
      <p className="mt-1 pl-9 text-[12px] text-[#8b93a1]">{timeAgo(c.createdAt, lang)}</p>
    </div>
  )
}

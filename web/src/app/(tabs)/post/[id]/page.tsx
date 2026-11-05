// 글 상세: 작성자, 번역된 본문·사진, 공감·스크랩, 익명 번호 댓글·대댓글, 아래 고정 댓글 입력, 글·댓글 신고 시트. 가려진 글·댓글은 안내 문구만
import { ArrowBendDownRight, BookmarkSimple, ChatCircle, CheckCircle, EyeSlash, Heart as HeartIcon, Info, PaperPlaneRight, PaperPlaneTilt, Siren, Trash } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { like, removePost, reportContent, scrap, submitComment, type ReportResult } from '@/app/board-actions'
import Avatar from '@/components/Avatar'
import LiveRefresh from '@/components/LiveRefresh'
import TrText from '@/components/TrText'
import { Flag, SanctionBanner, Sheet, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { loadBoards } from '@/lib/board/list'
import { anonNumbers, toCommentView, toPostView, type CommentView } from '@/lib/board/flow'
import { t, type Lang, type UiKey } from '@/lib/i18n'
import { isSuspended, REPORT_DETAIL_MAX, REPORT_REASONS, sanctionStatus } from '@/lib/moderation'
import { getStore } from '@/lib/store'
import { timeAgo } from '@/lib/time'
import type { Profile } from '@/lib/types'

/** 신고 결과 안내 문구(?reported=) */
const REPORTED: Record<ReportResult, UiKey> = { ok: 'reportOk', dup: 'reportDup', own: 'reportOwn', limit: 'reportLimit', fail: 'reportFail' }
const one = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : null)

export default async function PostPage({ params, searchParams }: PageProps<'/post/[id]'>) {
  const { id } = await params
  const sp = await searchParams
  const replyTo = one(sp.reply)
  // ?report=post 는 글 신고, ?report=<댓글 id> 는 그 댓글 신고 시트
  const reportParam = one(sp.report)
  const reportedRaw = one(sp.reported)
  const reported = reportedRaw && Object.hasOwn(REPORTED, reportedRaw) ? (reportedRaw as ReportResult) : null
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const post = await store.getPost(id)
  if (!post) notFound()
  const self = `/post/${encodeURIComponent(post.id)}`

  // 가려진 글: 쓴 사람에게도 제목·본문·사진·댓글을 보여 주지 않는다
  if (post.hidden) {
    return (
      <div className="space-y-3 pb-6 pt-1">
        <ReportedNotice lang={lang} reported={reported} />
        <div className="rise card mx-3 flex flex-col items-center gap-2 px-6 py-14 text-center">
          <EyeSlash size={32} className="text-muted" aria-hidden />
          <p className="text-[16px] font-bold">{t(lang, 'hiddenPost')}</p>
          <Link href="/rules" className="press text-[14px] font-medium text-muted underline">{t(lang, 'seeRules')}</Link>
        </div>
      </div>
    )
  }

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
  const replyTarget = replyTo ? roots.find(c => c.id === replyTo && !c.hidden) : undefined
  const mine = post.authorId === me.id
  // 신고 시트 대상: 남의 글이거나 남의 (가려지지 않은) 댓글만
  const reportTarget = reportParam === 'post'
    ? (mine ? null : { kind: 'post' as const, id: post.id })
    : reportParam && cs.some(c => c.id === reportParam && !c.mine && !c.hidden) ? { kind: 'comment' as const, id: reportParam } : null
  const suspended = isSuspended(me)

  return (
    <div className="space-y-3 pb-40 pt-1">
      <LiveRefresh topics={[`post:${post.id}`]} />
      <ReportedNotice lang={lang} reported={reported} />
      <article className="rise card mx-3 p-5">
        <Link href={`/board/${encodeURIComponent(post.board)}`} className="text-[13px] font-semibold text-teal">{board?.name ?? post.board}</Link>
        <div className="mt-3 flex items-center gap-3">
          <Avatar n={p.avatar} photo={p.photo} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[15px] font-bold"><Flag code={p.nation} size={12} /><span className="truncate">{p.author}</span></p>
            <p className="text-[13px] text-[#8b93a1]">{timeAgo(p.createdAt, lang)}</p>
          </div>
        </div>
        {/* 작성자 줄에 버튼까지 두면 좁은 화면에서 이름이 밀리므로 버튼은 한 줄 아래에 나란히 */}
        <div className="mt-3 flex gap-2">
          {mine && <form action={removePost.bind(null, post.id)} className="flex flex-1"><button className={`${btn.small} flex-1`}><Trash size={16} aria-hidden />{t(lang, 'delete')}</button></form>}
          {!mine && !post.anonymous && author && <Link href={`/messages/${encodeURIComponent(author.handle)}`} className={`${btn.small} flex-1`}><PaperPlaneTilt size={16} aria-hidden />{t(lang, 'messages')}</Link>}
          {!mine && <Link href={`${self}?report=post`} scroll={false} className={`${btn.small} flex-1`}><Siren size={16} aria-hidden />{t(lang, 'report')}</Link>}
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
                  <img src={src} alt="" loading="lazy" className="max-h-[70dvh] w-full rounded-2xl bg-bg-soft object-cover" />
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

      {suspended ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-[480px] bg-bg/95 pb-3 pt-2 backdrop-blur"><SanctionBanner lang={lang} status={sanctionStatus(me)} /></div>
      ) : (
        <form action={submitComment.bind(null, post.id)} className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-[480px] bg-bg/95 px-3 pb-3 pt-2 backdrop-blur">
          {replyTarget && (
            <p className="mb-1.5 flex items-center justify-between px-2 text-[13px] font-medium text-teal">
              <span className="flex min-w-0 items-center gap-1"><ArrowBendDownRight size={14} aria-hidden /><span className="truncate">{t(lang, 'replyingTo')}: {replyTarget.body.slice(0, 30)}</span></span>
              <Link href={`/post/${encodeURIComponent(post.id)}`} scroll={false} className="text-muted">{t(lang, 'cancel')}</Link>
            </p>
          )}
          <input type="hidden" name="parentId" value={replyTarget?.id ?? ''} />
          <div className="flex items-center gap-2 rounded-2xl bg-bg-soft py-1.5 pl-3 pr-1.5">
            {/* 비밀게시판은 항상 익명(체크를 풀 수 없음, 서버도 강제) */}
            <label className="flex min-h-10 shrink-0 items-center gap-1.5 px-1 text-[13px] font-semibold text-teal"><input type="checkbox" name="anonymous" defaultChecked disabled={anonOnly} className="h-5 w-5 accent-[var(--teal)]" />{t(lang, 'anonymous')}</label>
            {/* 답글을 달 때는 바로 입력할 수 있게 초점을 준다 */}
            <input name="body" required maxLength={2000} autoComplete="off" enterKeyHint="send" autoFocus={!!replyTarget} aria-label={t(lang, 'comment')} placeholder={t(lang, 'commentPlaceholder')} className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-[#a4abb8]" />
            <button aria-label={t(lang, 'submit')} className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><PaperPlaneRight size={18} weight="fill" aria-hidden /></button>
          </div>
        </form>
      )}

      {reportTarget && (
        <Sheet close={self} closeLabel={t(lang, 'close')}>
          <h2 className="text-[20px] font-bold tracking-tight">{t(lang, reportTarget.kind === 'post' ? 'reportPostTitle' : 'reportCommentTitle')}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{t(lang, 'reportDesc')}</p>
          <form action={reportContent.bind(null, reportTarget.kind, reportTarget.id)} className="mt-4 space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[14px] font-semibold text-muted">{t(lang, 'reportReason')}</legend>
              {REPORT_REASONS.map(r => (
                <label key={r} className="press flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-bg-soft px-4 text-[15px] font-medium has-[:checked]:bg-navy/8 has-[:checked]:text-navy">
                  <input type="radio" name="reason" value={r} required className="h-5 w-5 accent-[var(--navy)]" />{t(lang, `reason.${r}`)}
                </label>
              ))}
            </fieldset>
            <textarea name="detail" maxLength={REPORT_DETAIL_MAX} rows={3} aria-label={t(lang, 'reportDetail')} placeholder={t(lang, 'reportDetail')}
              className="w-full resize-none rounded-2xl bg-bg-soft p-4 text-[16px] leading-relaxed outline-none placeholder:text-[#a4abb8] focus:ring-2 focus:ring-navy/20" />
            <button className={btn.primary}>{t(lang, 'reportSubmit')}</button>
          </form>
        </Sheet>
      )}
    </div>
  )
}

/** 신고 뒤 돌아왔을 때 결과 안내 */
function ReportedNotice({ lang, reported }: { lang: Lang; reported: ReportResult | null }) {
  if (!reported) return null
  const ok = reported === 'ok'
  const Icon = ok ? CheckCircle : Info
  return (
    <p role="status" className={`rise mx-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold ${ok ? 'bg-mint-soft text-mint-text' : 'bg-bg text-ink'}`}>
      <Icon size={20} weight="fill" className="shrink-0" aria-hidden />{t(lang, REPORTED[reported])}
    </p>
  )
}

function CommentRow({ c, lang, postId, reply }: { c: CommentView; lang: Lang; postId: string; reply?: boolean }) {
  if (c.hidden) {
    return (
      <p className="flex items-center gap-2 px-5 py-4 text-[14px] text-muted">
        <EyeSlash size={16} className="shrink-0" aria-hidden />{t(lang, 'hiddenComment')}
      </p>
    )
  }
  const self = `/post/${encodeURIComponent(postId)}`
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-2">
        <Avatar n={c.avatar} photo={c.photo} size={28} />
        <span className={`flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-bold ${c.isPostAuthor ? 'text-teal' : ''}`}><Flag code={c.nation} size={11} /><span className="truncate">{c.author}</span></span>
        {/* 손가락으로 누르기 쉽게 버튼은 36px 이상, 줄 높이는 -my-1로 유지 */}
        <span className="-my-1 flex shrink-0 items-center gap-0.5">
          {!reply && <Link href={`${self}?reply=${encodeURIComponent(c.id)}`} scroll={false} className={ACT}>{t(lang, 'reply')}</Link>}
          {!c.mine && <Link href={`${self}?report=${encodeURIComponent(c.id)}`} scroll={false} aria-label={`${t(lang, 'report')}: ${c.author}`} className={ACT}>{t(lang, 'report')}</Link>}
          <form action={like.bind(null, 'comment', c.id, !c.liked)}><button aria-label={t(lang, 'like')} aria-pressed={c.liked} className={`${ACT} gap-0.5 font-semibold ${c.liked ? 'text-danger' : ''}`}><HeartIcon size={14} weight={c.liked ? 'fill' : 'regular'} aria-hidden />{c.likes || ''}</button></form>
        </span>
      </div>
      <div className="mt-1.5 pl-9 text-[15px] leading-relaxed"><TrText text={c.body} original={c.originalBody} translated={c.translated} pending={c.pending} from={c.from} viewer={lang} /></div>
      <p className="mt-1 pl-9 text-[12px] text-[#8b93a1]">{timeAgo(c.createdAt, lang)}</p>
    </div>
  )
}

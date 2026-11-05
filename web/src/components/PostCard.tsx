// 게시판 목록의 글 한 줄: 제목·본문 한 줄·시간·작성자, 공감·댓글 수, 오른쪽 사진 미리보기
import { ChatCircle, Globe, Heart as HeartIcon } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { Flag } from '@/components/ui'
import type { PostView } from '@/lib/board/flow'
import { LANGS, t, type Lang } from '@/lib/i18n'
import { timeAgo } from '@/lib/time'

export const Heart = () => <HeartIcon size={14} weight="bold" className="inline -mt-0.5" aria-hidden />
export const Bubble = () => <ChatCircle size={14} weight="bold" className="inline -mt-0.5" aria-hidden />

export default function PostCard({ p, lang, showBoard }: { p: PostView & { boardLabel?: string }; lang: Lang; showBoard?: boolean }) {
  const fromName = LANGS.find(l => l.code === p.from)?.label ?? p.from
  return (
    <Link href={`/post/${encodeURIComponent(p.id)}`} className="tap flex gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        {showBoard && p.boardLabel && <p className="mb-1 text-[12px] font-semibold text-teal">{p.boardLabel}</p>}
        <p className="line-clamp-1 text-[16px] font-bold">{p.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[14px] text-muted">{p.body}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#8b93a1]">
          <Flag code={p.nation} size={11} />
          <span className="min-w-0 truncate">{p.author}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 whitespace-nowrap">{timeAgo(p.createdAt, lang)}</span>
          {(p.translated || p.pending) && (
            <>
              <Globe size={13} className={`shrink-0 text-teal ${p.pending ? 'animate-pulse' : ''}`} aria-hidden />
              <span className="sr-only">{p.pending ? t(lang, 'translating') : t(lang, 'translatedFrom', { lang: fromName })}</span>
            </>
          )}
          <span className="ml-auto flex shrink-0 gap-2.5 whitespace-nowrap font-semibold">
            {p.likes > 0 && <span className="text-danger"><Heart /> {p.likes}<span className="sr-only"> {t(lang, 'like')}</span></span>}
            {p.comments > 0 && <span className="text-teal"><Bubble /> {p.comments}<span className="sr-only"> {t(lang, 'comment')}</span></span>}
          </span>
        </div>
      </div>
      {p.images.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/img/${encodeURIComponent(p.images[0])}`} alt="" loading="lazy" className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover" />
      )}
    </Link>
  )
}

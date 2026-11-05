// 삼척캠퍼스 학사·일반 공지 목록(학생 화면·방문객 화면 공통): 학교 사이트 실제 정보, 오늘(한국) 글 표시, 키가 있으면 3줄 요약·마감 D-day
import { ArrowSquareOut, ImageSquare, Megaphone, Paperclip } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import ApplyHelper from '@/components/ApplyHelper'
import { DayRefresh } from '@/components/BottomNav'
import { TodayBadge } from '@/components/SchoolCards'
import { Empty } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'
import { kstDay } from '@/lib/school/memo'
import { safeHttpUrl, type NoticeBoard } from '@/lib/school/notices'
import { noticeCards } from '@/lib/school/service'

/** mode: 학생 화면이면 "신청 준비해 줘"로 내 마감에 담을 수 있다. saved: 이미 담은 공지("게시판:번호" → 할 일 id) */
export default async function NoticeList({ lang, board, boardHref, mode = 'visit', saved = {} }: { lang: Lang; board: NoticeBoard; boardHref: Record<NoticeBoard, string>; mode?: 'student' | 'visit'; saved?: Record<string, string> }) {
  const { items, source } = await noticeCards(board, lang, 8)
  return (
    <div className="space-y-3 pb-6 pt-1">
      <DayRefresh day={kstDay().iso} />
      <nav aria-label={t(lang, 'notices')} className="rise mx-3 grid grid-cols-2 gap-1 rounded-2xl bg-line/60 p-1">
        {(['academic', 'general'] as const).map(b => (
          <Link key={b} href={boardHref[b]} aria-current={b === board ? 'page' : undefined}
            className={`press rounded-xl py-3 text-center text-[15px] font-semibold ${b === board ? 'bg-bg text-ink shadow-sm' : 'text-muted'}`}>{t(lang, b === 'academic' ? 'notices' : 'generalNotices')}</Link>
        ))}
      </nav>
      {source === 'snapshot' && <p data-fail="notice_snapshot" className="px-5 text-[13px] text-muted">{t(lang, 'snapshot')}</p>}
      {items.length === 0 && <div data-fail="notice_empty" className="card mx-3"><Empty icon={<Megaphone size={28} weight="fill" />} title={t(lang, 'noData')} /></div>}
      <ul className="space-y-3">
        {items.map(n => {
          const href = safeHttpUrl(n.url)
          return (
            <li key={n.id} data-notice={`${n.board}:${n.id}`} className="rise card mx-3 p-5">
              <p className="text-[13px] font-medium text-muted">{[n.date, n.dept].filter(Boolean).join(' · ')}</p>
              <p className="mt-1.5 text-[17px] font-bold leading-snug">{n.isToday && <TodayBadge lang={lang} />}{n.titleTr}</p>
              {n.titleTr !== n.title && <p lang="ko" className="mt-0.5 text-[13px] text-muted">{n.title}</p>}
              {n.deadline && <p className="mt-2 inline-block rounded-lg bg-danger/10 px-2 py-1 text-[12px] font-bold text-danger">{t(lang, 'deadline')} {n.deadline}{n.dday && ` · ${n.dday}`}</p>}
              {n.bullets.length > 0
                ? <ul className="mt-3 space-y-1 text-[15px]">{n.bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden /><span className="min-w-0 flex-1">{b}</span></li>)}</ul>
                : n.excerpt && <p lang="ko" className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-ink/80">{n.excerpt}</p>}
              <ApplyHelper n={n} lang={lang} mode={mode} taskId={saved[`${n.board}:${n.id}`] ?? null} />
              {(n.images > 0 || n.files.length > 0) && (
                <div className="mt-3 space-y-1.5 rounded-2xl bg-bg-soft px-4 py-3 text-[13px] text-muted">
                  {n.images > 0 && <p className="flex items-center gap-1.5"><ImageSquare size={16} aria-hidden />{t(lang, 'imagesN', { n: n.images })}</p>}
                  {n.files.map((f, i) => <p key={`${i}-${f}`} className="flex items-center gap-1.5"><Paperclip size={16} className="shrink-0" aria-hidden /><span className="truncate">{f}</span></p>)}
                </div>
              )}
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" data-track="original" className="press mt-4 flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-bg-soft text-[15px] font-semibold">
                  {t(lang, 'viewOriginalSite')}<ArrowSquareOut size={16} aria-hidden />
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

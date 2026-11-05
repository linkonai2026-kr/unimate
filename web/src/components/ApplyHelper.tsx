// 공지 카드 안의 신청 도우미: AI가 뽑은 신청 방법·제출처·준비물을 보여 준다. 학생은 "신청 준비해 줘" 한 번으로
// 내 마감 저장 → 준비 화면(캘린더 등록·제출처 안내·담당 부서 메일 초안)까지 이어지고, 이미 담았으면 준비 화면 링크가 나온다
import { ArrowSquareOut, CalendarPlus, CheckCircle, ListChecks, NavigationArrow, Sparkle } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { prepareNotice } from '@/app/deadline-actions'
import { HOW_KEY, icsHref, officeRouteHref } from '@/lib/deadlines/links'
import { t, type Lang } from '@/lib/i18n'
import type { NoticeCard } from '@/lib/school/service'

const chip = 'press inline-flex h-10 items-center gap-1.5 rounded-xl bg-bg px-3 text-[14px] font-semibold text-ink'

export default function ApplyHelper({ n, lang, mode, taskId }: { n: NoticeCard; lang: Lang; mode: 'student' | 'visit'; taskId: string | null }) {
  const a = n.apply
  if (!a && !n.deadline) return null
  const ics = icsHref({ title: n.titleTr || n.title, deadline: n.deadline, lang, apply: a, url: n.url })
  const route = officeRouteHref(a?.where, mode, lang)
  return (
    <section aria-label={t(lang, 'applyHelper')} className="mt-3 rounded-2xl bg-teal/8 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-teal">
        <Sparkle size={15} weight="fill" aria-hidden />{t(lang, 'applyHelper')}
        {a && <span className="font-semibold text-ink/70">· {t(lang, HOW_KEY[a.how])}</span>}
      </p>
      {a?.where && <p className="mt-2 text-[14px]"><span className="font-semibold">{t(lang, 'submitTo')}</span> {a.where}</p>}
      {a && a.documents.length > 0 && (
        <div className="mt-2 text-[14px]">
          <p className="flex items-center gap-1 font-semibold"><ListChecks size={16} aria-hidden />{t(lang, 'toPrepare')}</p>
          <ul className="mt-1 space-y-0.5 pl-5">{a.documents.map((d, i) => <li key={i} className="list-disc">{d}</li>)}</ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === 'student' && (taskId
          ? <Link href={`/deadlines/${taskId}`} className={`${chip} text-teal`}><CheckCircle size={17} weight="fill" aria-hidden />{t(lang, 'openPrep')}</Link>
          : (
            <form action={prepareNotice.bind(null, n.board, n.id)}>
              <button data-track="prepare" className="press inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal px-3 text-[14px] font-bold text-white"><Sparkle size={17} weight="fill" aria-hidden />{t(lang, 'prepareApply')}</button>
            </form>
          ))}
        {ics && <a href={ics} data-track="ics" className={chip}><CalendarPlus size={17} aria-hidden />{t(lang, 'addCalendar')}</a>}
        {route && <Link href={route} data-track="route" className={chip}><NavigationArrow size={17} aria-hidden />{t(lang, 'routeToOffice')}</Link>}
        {a?.url && <a href={a.url} target="_blank" rel="noopener noreferrer" data-track="apply_page" className={chip}>{t(lang, 'openApplyPage')}<ArrowSquareOut size={15} aria-hidden /></a>}
      </div>
    </section>
  )
}

// 공지 카드 안의 신청 도우미: AI가 뽑은 신청 방법·제출처·준비물을 보여 주고, 버튼 한 번으로
// 내 마감에 담기(학생), 캘린더 등록(.ics), 제출처 길찾기, 신청 페이지 열기까지 이어 준다
import { ArrowSquareOut, CalendarPlus, CheckCircle, ListChecks, NavigationArrow, Sparkle } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { prepareNotice } from '@/app/deadline-actions'
import { HOW_KEY, icsHref, officeRouteHref } from '@/lib/deadlines/links'
import { t, type Lang } from '@/lib/i18n'
import type { NoticeCard } from '@/lib/school/service'

const chip = 'press inline-flex h-10 items-center gap-1.5 rounded-xl bg-bg px-3 text-[14px] font-semibold text-ink'

export default function ApplyHelper({ n, lang, mode, saved }: { n: NoticeCard; lang: Lang; mode: 'student' | 'visit'; saved: boolean }) {
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
        {mode === 'student' && (saved
          ? <span className={`${chip} text-teal`}><CheckCircle size={17} weight="fill" aria-hidden />{t(lang, 'prepared')}</span>
          : (
            <form action={prepareNotice.bind(null, n.board, n.id)}>
              <button className="press inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal px-3 text-[14px] font-bold text-white"><Sparkle size={17} weight="fill" aria-hidden />{t(lang, 'prepareApply')}</button>
            </form>
          ))}
        {ics && <a href={ics} className={chip}><CalendarPlus size={17} aria-hidden />{t(lang, 'addCalendar')}</a>}
        {route && <Link href={route} className={chip}><NavigationArrow size={17} aria-hidden />{t(lang, 'routeToOffice')}</Link>}
        {a?.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className={chip}>{t(lang, 'openApplyPage')}<ArrowSquareOut size={15} aria-hidden /></a>}
      </div>
    </section>
  )
}

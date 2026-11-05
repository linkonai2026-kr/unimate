// 신청 준비 화면: "신청 준비해 줘" 한 번으로 이어지는 단계를 한곳에 모은다.
// ① 준비물 체크리스트(내 마감에 저장됨) ② 캘린더 등록(처음 들어오면 바로 열림) ③ 제출처 안내·길찾기 ④ 담당 부서 메일 초안(AI)
import { ArrowSquareOut, CalendarPlus, CheckCircle, CheckSquare, NavigationArrow, Square } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { setTaskDone, toggleTaskItem } from '@/app/deadline-actions'
import AutoCalendar from '@/components/AutoCalendar'
import MailDraft from '@/components/MailDraft'
import { requireUser } from '@/lib/auth/session'
import { HOW_KEY, icsHref, officeRouteHref } from '@/lib/deadlines/links'
import { officeEmails } from '@/lib/deadlines/mail'
import { getTaskStore } from '@/lib/deadlines/store'
import { dDayOf } from '@/lib/deadlines/when'
import { t } from '@/lib/i18n'

const chip = 'press inline-flex h-10 items-center gap-1.5 rounded-xl bg-bg-soft px-3 text-[14px] font-semibold text-ink'

function Step({ n, done, title, children }: { n: number; done?: boolean; title: string; children: ReactNode }) {
  return (
    <li className="rise card mx-3 p-5">
      <h2 className="flex items-center gap-2.5 text-[17px] font-bold">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${done ? 'bg-teal text-white' : 'bg-navy text-white'}`} aria-hidden>
          {done ? <CheckCircle size={18} weight="fill" /> : n}
        </span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </li>
  )
}

export default async function DeadlinePrepPage({ params, searchParams }: PageProps<'/deadlines/[id]'>) {
  const [me, { id }, sp] = await Promise.all([requireUser(), params, searchParams])
  const lang = me.lang
  const task = /^[\w-]{1,64}$/.test(id) ? await getTaskStore().get(me.id, id).catch(() => null) : null
  if (!task) notFound()
  const a = task.apply
  const dday = task.deadline ? dDayOf(task.deadline) : null
  const ics = icsHref({ title: task.title, deadline: task.deadline, lang, apply: a, url: task.url })
  const route = officeRouteHref(a?.where, 'student', lang)
  const emails = await officeEmails(task).catch(() => [] as string[])

  return (
    <div className="space-y-3 pb-10 pt-1">
      {sp.new === '1' && ics && <AutoCalendar href={ics} taskId={task.id} />}

      <section className="rise mx-3 rounded-[24px] bg-navy p-5 text-white">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-mint"><CheckCircle size={16} weight="fill" aria-hidden />{t(lang, 'prepTitle')}</p>
        <h1 className="mt-2 text-[22px] font-bold leading-snug tracking-tight">{task.title}</h1>
        {task.deadline && (
          <p className="mt-2 flex items-center gap-2 text-[15px] text-white/80">
            {dday && <span className="rounded-lg bg-danger px-2 py-0.5 text-[13px] font-bold text-white">{dday}</span>}
            {t(lang, 'deadline')} {task.deadline}
          </p>
        )}
        <p className="mt-3 text-[14px] text-white/70">{t(lang, 'prepIntro')}</p>
      </section>

      <ol className="space-y-3">
        <Step n={1} done title={t(lang, 'stepSaved')}>
          {a && a.documents.length > 0 ? (
            <ul className="space-y-0.5">
              {a.documents.map((d, i) => {
                const on = task.checked.includes(i)
                return (
                  <li key={i}>
                    <form action={toggleTaskItem.bind(null, task.id, i)}>
                      <button aria-pressed={on} className={`tap flex w-full items-center gap-2 rounded-lg py-1.5 text-left text-[15px] ${on ? 'text-muted line-through' : ''}`}>
                        {on ? <CheckSquare size={22} weight="fill" className="shrink-0 text-teal" aria-hidden /> : <Square size={22} className="shrink-0 text-muted" aria-hidden />}{d}
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          ) : <p className="text-[14px] text-muted">{t(lang, 'noDocuments')}</p>}
        </Step>

        <Step n={2} title={t(lang, 'stepCalendar')}>
          {ics ? (
            <>
              <a href={ics} data-track="ics" className={chip}><CalendarPlus size={18} aria-hidden />{t(lang, 'addCalendar')}</a>
              <p className="mt-2 text-[13px] text-muted">{t(lang, 'calendarHint')}</p>
            </>
          ) : <p className="text-[14px] text-muted">{t(lang, 'noCalendar')}</p>}
        </Step>

        <Step n={3} title={t(lang, 'stepOffice')}>
          {a?.where
            ? <p className="text-[15px]"><span className="font-semibold">{t(lang, 'submitTo')}</span> {a.where}</p>
            : <p className="text-[14px] text-muted">{t(lang, 'noOffice')}</p>}
          {a && <p className="mt-1 text-[14px] text-muted">{t(lang, HOW_KEY[a.how])}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {route && <Link href={route} data-track="route" className={chip}><NavigationArrow size={18} aria-hidden />{t(lang, 'routeToOffice')}</Link>}
            {a?.url && <a href={a.url} target="_blank" rel="noopener noreferrer" data-track="apply_page" className={chip}>{t(lang, 'openApplyPage')}<ArrowSquareOut size={15} aria-hidden /></a>}
            <a href={task.url} target="_blank" rel="noopener noreferrer" data-track="original" className={chip}>{t(lang, 'viewOriginalSite')}<ArrowSquareOut size={15} aria-hidden /></a>
          </div>
        </Step>

        <Step n={4} title={t(lang, 'stepMail')}>
          <p className="mb-3 text-[14px] text-muted">{t(lang, 'mailIntro')}</p>
          <MailDraft taskId={task.id} lang={lang} emails={emails} defaults={{ name: me.nickname, major: me.major ?? '', studentId: me.year ?? '' }} />
        </Step>
      </ol>

      <div className="mx-3 grid grid-cols-2 gap-2 pt-2">
        {task.done
          ? <span className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-mint-soft text-[15px] font-bold text-mint-text"><CheckCircle size={18} weight="fill" aria-hidden />{t(lang, 'markDone')}</span>
          : <form action={setTaskDone.bind(null, task.id, true)}><button className="press flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-teal text-[15px] font-bold text-white"><CheckCircle size={18} weight="fill" aria-hidden />{t(lang, 'markDone')}</button></form>}
        <Link href="/" className="press flex h-12 items-center justify-center rounded-2xl bg-bg-soft text-[15px] font-semibold text-ink">{t(lang, 'myDeadlines')}</Link>
      </div>
    </div>
  )
}

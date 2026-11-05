// 홈의 "내 마감": 공지에서 담은 신청 할 일을 마감 가까운 순으로. 준비물 체크, 캘린더 등록, 제출처 길찾기, 신청 페이지, 완료·빼기
import { ArrowSquareOut, CalendarPlus, CheckCircle, CheckSquare, ClockCountdown, NavigationArrow, Square, Trash } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { removeTask, setTaskDone, toggleTaskItem } from '@/app/deadline-actions'
import { Section } from '@/components/ui'
import { HOW_KEY, icsHref, officeRouteHref } from '@/lib/deadlines/links'
import { getTaskStore, type DeadlineTask } from '@/lib/deadlines/store'
import { dDayOf } from '@/lib/deadlines/when'
import { t, type Lang } from '@/lib/i18n'
import type { Profile } from '@/lib/types'

const chip = 'press inline-flex h-9 items-center gap-1 rounded-xl bg-bg-soft px-3 text-[13px] font-semibold text-ink'

function OpenTask({ task, lang }: { task: DeadlineTask; lang: Lang }) {
  const a = task.apply
  const dday = task.deadline ? dDayOf(task.deadline) : null
  const ics = icsHref({ title: task.title, deadline: task.deadline, lang, apply: a, url: task.url })
  const route = officeRouteHref(a?.where, 'student', lang)
  const urgent = dday === 'D-day' || dday === 'D-1' || dday === 'D-2'
  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-2">
        {task.deadline && (
          <span className={`mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold ${urgent ? 'bg-danger text-white' : 'bg-danger/10 text-danger'}`}>{dday ?? task.deadline}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold leading-snug">{task.title}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {[task.deadline && `${t(lang, 'deadline')} ${task.deadline}`, a && t(lang, HOW_KEY[a.how]), a?.where].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {a && a.documents.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {a.documents.map((d, i) => {
            const on = task.checked.includes(i)
            return (
              <li key={i}>
                <form action={toggleTaskItem.bind(null, task.id, i)}>
                  <button aria-pressed={on} className={`tap flex w-full items-center gap-2 rounded-lg py-1 text-left text-[14px] ${on ? 'text-muted line-through' : ''}`}>
                    {on ? <CheckSquare size={20} weight="fill" className="shrink-0 text-teal" aria-hidden /> : <Square size={20} className="shrink-0 text-muted" aria-hidden />}{d}
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {ics && <a href={ics} className={chip}><CalendarPlus size={16} aria-hidden />{t(lang, 'addCalendar')}</a>}
        {route && <Link href={route} className={chip}><NavigationArrow size={16} aria-hidden />{t(lang, 'routeToOffice')}</Link>}
        {a?.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className={chip}>{t(lang, 'openApplyPage')}<ArrowSquareOut size={14} aria-hidden /></a>}
        <form action={setTaskDone.bind(null, task.id, true)}><button className={`${chip} text-teal`}><CheckCircle size={16} weight="fill" aria-hidden />{t(lang, 'markDone')}</button></form>
        <form action={removeTask.bind(null, task.id)}><button aria-label={t(lang, 'removeDeadline')} className={`${chip} text-muted`}><Trash size={16} aria-hidden /></button></form>
      </div>
    </li>
  )
}

export default async function MyDeadlines({ me }: { me: Profile }) {
  const lang = me.lang
  const tasks = await getTaskStore().list(me.id).catch(e => {
    console.warn('[MyDeadlines]', e instanceof Error ? e.message : e)
    return [] as DeadlineTask[]
  })
  const open = tasks.filter(x => !x.done)
  const done = tasks.filter(x => x.done).slice(0, 3)
  return (
    <Section title={<span className="flex items-center gap-1.5"><ClockCountdown size={20} weight="fill" className="text-danger" aria-hidden />{t(lang, 'myDeadlines')}</span>} more="/notices" moreLabel={t(lang, 'notices')}>
      {tasks.length === 0 && <p className="px-5 pb-5 pt-2 text-[14px] text-muted">{t(lang, 'noDeadlines')}</p>}
      {open.length > 0 && <ul className="divide-y divide-line/70">{open.map(task => <OpenTask key={task.id} task={task} lang={lang} />)}</ul>}
      {done.length > 0 && (
        <ul className="border-t border-line/70 pb-2">
          {done.map(task => (
            <li key={task.id} className="flex items-center gap-2 px-5 py-2 text-[14px] text-muted">
              <CheckCircle size={18} weight="fill" className="shrink-0 text-teal" aria-hidden />
              <span className="min-w-0 flex-1 truncate line-through">{task.title}</span>
              <form action={setTaskDone.bind(null, task.id, false)}><button className="press text-[13px] font-semibold">{t(lang, 'undoDone')}</button></form>
              <form action={removeTask.bind(null, task.id)}><button aria-label={t(lang, 'removeDeadline')} className="press p-1"><Trash size={16} aria-hidden /></button></form>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

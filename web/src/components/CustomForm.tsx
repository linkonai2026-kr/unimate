'use client'
// 시간표에 직접 일정 넣기(30분 단위, 끝은 시작보다 뒤만 고를 수 있고, 겹치거나 틀리면 안내)
import { CalendarPlus } from '@phosphor-icons/react'
import { startTransition, useActionState, useState } from 'react'
import { addCustom } from '@/app/timetable-actions'
import { btn, field } from '@/components/ui'
import { dayName, t, type Lang } from '@/lib/i18n'
import { DAYS, SLOT_END, SLOT_START, fmtMin, toMin } from '@/lib/timetable/slots'

/** 09:00–21:00, 30분 단위 */
const TIMES = Array.from({ length: (SLOT_END - SLOT_START) / 30 + 1 }, (_, i) => fmtMin(SLOT_START + i * 30))

type State = { error: 'clash' | 'invalid' } | null

export default function CustomForm({ tableId, lang, open: initial }: { tableId: string; lang: Lang; open: boolean }) {
  const [open, setOpen] = useState(initial)
  // 입력값을 상태로 들고 있어서, 겹침 안내 뒤 폼이 초기화돼도 적은 내용이 남는다
  const [v, setV] = useState({ name: '', place: '', day: '0', start: '09:00', end: '10:00' })
  const [state, action, pending] = useActionState(async (_: State, f: FormData): Promise<State> => (await addCustom(tableId, f)) ?? null, null)
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV(x => ({ ...x, [k]: e.target.value }))
  const setStart = (e: { target: { value: string } }) => {
    const start = e.target.value
    // 끝이 시작보다 앞서게 되면 시작 30분 뒤로 민다
    setV(x => ({ ...x, start, end: toMin(x.end) > toMin(start) ? x.end : fmtMin(toMin(start) + 30) }))
  }

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="press flex w-full items-center gap-3 px-5 py-4 text-left">
      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal/10 text-teal" aria-hidden><CalendarPlus size={22} weight="fill" /></span>
      <span className="text-[16px] font-semibold">{t(lang, 'customSchedule')}</span>
    </button>
  )
  return (
    // action={...} 대신 onSubmit: 폼 액션은 끝나면 폼을 초기화해서, 겹침 안내 뒤 고른 요일·시간과 화면 값이 어긋난다
    <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); startTransition(() => action(f)) }} className="space-y-3 px-5 py-4">
      <input name="name" required maxLength={20} value={v.name} onChange={set('name')} aria-label={t(lang, 'customPlaceholder')} placeholder={t(lang, 'customPlaceholder')} className={field} />
      <input name="place" maxLength={40} value={v.place} onChange={set('place')} aria-label={t(lang, 'place')} placeholder={t(lang, 'place')} className={field} />
      <div className="grid grid-cols-3 gap-2">
        <select name="day" value={v.day} onChange={set('day')} aria-label={t(lang, 'day')} className={field}>
          {Array.from({ length: DAYS }, (_, d) => <option key={d} value={d}>{dayName(d, lang)}</option>)}
        </select>
        <select name="start" value={v.start} onChange={setStart} aria-label={t(lang, 'start')} className={field}>
          {TIMES.slice(0, -1).map(x => <option key={x}>{x}</option>)}
        </select>
        <select name="end" value={v.end} onChange={set('end')} aria-label={t(lang, 'end')} className={field}>
          {TIMES.filter(x => toMin(x) > toMin(v.start)).map(x => <option key={x}>{x}</option>)}
        </select>
      </div>
      {state?.error && <p role="alert" className="text-[14px] font-medium text-danger">{t(lang, state.error === 'clash' ? 'clashLabel' : 'warnInvalid')}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className={btn.soft}>{t(lang, 'cancel')}</button>
        <button disabled={pending} className={`${btn.primary} h-12 text-[15px]`}>{t(lang, 'add')}</button>
      </div>
    </form>
  )
}

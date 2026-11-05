'use client'
// 학점계산기 편집기: 큰 숫자로 전체·전공 평점과 취득 학점, 학기 탭, 과목 행 편집, 저장
import { CheckCircle, Plus, X } from '@phosphor-icons/react'
import { useRef, useState, useTransition } from 'react'
import { saveGrades } from '@/app/timetable-actions'
import { BottomCTA, btn } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'
import { GRADES, MAX_ROWS, MAX_SEMS, gpa, type GradeRow, type GradeSemester } from '@/lib/timetable/grades'

const SEM_NAMES = ['1학년 1학기', '1학년 2학기', '2학년 1학기', '2학년 2학기', '3학년 1학기', '3학년 2학기', '4학년 1학기', '4학년 2학기']
const CREDITS = [1, 2, 3, 4]
const GRADE_KEYS = Object.keys(GRADES)

export default function GradeEditor({ lang, initial }: { lang: Lang; initial: GradeSemester[] }) {
  const [sems, setSems] = useState<GradeSemester[]>(initial.length ? initial : [{ name: SEM_NAMES[0], rows: [] }])
  const [cur, setCur] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  /** 저장 중에 또 고치면 "저장됨"으로 바꾸지 않도록 고친 횟수를 센다 */
  const version = useRef(0)
  const sem = sems[Math.min(cur, sems.length - 1)]
  const total = gpa(sems), here = gpa([sem])

  const edit = (fn: (s: GradeSemester) => GradeSemester) => {
    version.current++
    setSaved(false)
    setSems(all => all.map((s, i) => (i === cur ? fn(s) : s)))
  }
  const setRow = (i: number, patch: Partial<GradeRow>) => edit(s => ({ ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const addSemester = () => {
    if (sems.length >= Math.min(SEM_NAMES.length, MAX_SEMS)) return
    version.current++
    setSaved(false)
    setSems([...sems, { name: SEM_NAMES[sems.length], rows: [] }])
    setCur(sems.length)
  }
  const save = () => start(async () => {
    const v = version.current
    setError('')
    try {
      const r = await saveGrades(sems)
      if (r.error) setError(t(lang, 'warnInvalid'))
      else if (v === version.current) setSaved(true)
    } catch {
      setError(t(lang, 'tryAgain'))
    }
  })
  const field = 'h-11 min-w-0 rounded-xl bg-bg-soft px-3 text-[15px] outline-none focus:ring-2 focus:ring-navy/20'

  return (
    <div className="space-y-3 px-3 pb-40 pt-1">
      <section className="rise rounded-[24px] bg-navy p-5 text-white" aria-live="polite">
        <p className="text-[14px] text-white/70">{t(lang, 'avgGrade')}</p>
        <p className="mt-1 text-[40px] font-bold leading-none tracking-tight">{total.avg.toFixed(2)}<span className="text-[18px] font-medium text-white/60"> / 4.5</span></p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[13px] text-white/70">{t(lang, 'majorAvg')}</p><p className="text-[22px] font-bold">{total.majorAvg.toFixed(2)}</p></div>
          <div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[13px] text-white/70">{t(lang, 'earnedCredits')}</p><p className="text-[22px] font-bold">{total.credits}</p></div>
        </div>
      </section>

      <nav className="flex gap-1.5 overflow-x-auto px-1 py-1">
        {sems.map((s, i) => <button key={i} type="button" onClick={() => setCur(i)} aria-pressed={s === sem} className={`press shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold ${s === sem ? 'bg-navy text-white' : 'bg-bg text-ink'}`}>{s.name}</button>)}
        {sems.length < Math.min(SEM_NAMES.length, MAX_SEMS) && <button type="button" onClick={addSemester} className="press flex shrink-0 items-center gap-1 rounded-full bg-bg px-4 py-2 text-[14px] font-semibold text-teal"><Plus size={14} weight="bold" />{t(lang, 'addSemester')}</button>}
      </nav>

      <section className="rise card space-y-2 p-4">
        <p className="px-1 text-[15px] text-muted">{sem.name} · {t(lang, 'avgGrade')} <b className="text-ink">{here.avg.toFixed(2)}</b> · {t(lang, 'creditsN', { n: String(here.credits) })}</p>
        <ul className="space-y-2">
          {sem.rows.map((r, i) => (
            <li key={i} className="space-y-2 rounded-2xl border border-line/70 p-2">
              <div className="flex gap-1.5">
                <input value={r.name} maxLength={30} onChange={e => setRow(i, { name: e.target.value })} aria-label={t(lang, 'courseName')} placeholder={t(lang, 'courseName')} className={`${field} flex-1`} />
                <button type="button" onClick={() => edit(s => ({ ...s, rows: s.rows.filter((_, j) => j !== i) }))} aria-label={t(lang, 'delete')} className="press flex h-11 w-11 items-center justify-center rounded-xl text-danger"><X size={18} weight="bold" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <select value={r.credit} onChange={e => setRow(i, { credit: Number(e.target.value) })} aria-label={t(lang, 'creditAll')} className={field}>
                  {/* 예전에 저장된 학점이 목록에 없으면 그 값도 보여 준다 */}
                  {(CREDITS.includes(r.credit) ? CREDITS : [...CREDITS, r.credit].sort((a, b) => a - b)).map(n => <option key={n} value={n}>{t(lang, 'creditsN', { n: String(n) })}</option>)}
                </select>
                <select value={r.grade} onChange={e => setRow(i, { grade: e.target.value })} aria-label={t(lang, 'grade')} className={field}>{GRADE_KEYS.map(g => <option key={g}>{g}</option>)}</select>
                <label className={`${field} flex items-center justify-center gap-1.5 font-medium`}><input type="checkbox" checked={r.major} onChange={e => setRow(i, { major: e.target.checked })} className="h-4 w-4 accent-[var(--teal)]" />{t(lang, 'major')}</label>
              </div>
            </li>
          ))}
        </ul>
        {sem.rows.length < MAX_ROWS && <button type="button" onClick={() => edit(s => ({ ...s, rows: [...s.rows, { name: '', credit: 3, grade: 'A+', major: false }] }))} className={btn.soft}><Plus size={18} weight="bold" />{t(lang, 'addRow')}</button>}
      </section>

      <BottomCTA>
        {error && <p role="alert" className="pb-2 text-center text-[14px] font-medium text-danger">{error}</p>}
        <button type="button" disabled={pending} onClick={save} className={saved ? btn.mint : btn.primary}>
          {saved ? <><CheckCircle size={20} weight="fill" />{t(lang, 'saved')}</> : t(lang, 'save')}
        </button>
      </BottomCTA>
    </div>
  )
}

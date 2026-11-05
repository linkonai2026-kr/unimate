'use client'
// 캡처를 올려 인식 → 미리보기·수정(고칠 때마다 다시 검사) → 저장하는 클라이언트 화면
import { Camera, Plus, Warning as WarningIcon, X } from '@phosphor-icons/react'
import { useMemo, useRef, useState, useTransition } from 'react'
import { saveCourses } from '@/app/timetable-actions'
import TimetableGrid from '@/components/TimetableGrid'
import { BottomCTA, btn } from '@/components/ui'
import { dayName, t, type Lang, type UiKey } from '@/lib/i18n'
import { DAYS, NAME_MAX, PLACE_MAX, fmtMin, normalizeParsed, type Warning } from '@/lib/timetable/slots'

type Row = { id: number; name: string; place: string; day: number; start: string; end: string }
type Parsed = { courses: { name: string; place: string; day: number; start: number; end: number }[]; warnings?: Warning[] }
const WARN: Record<Warning['code'], UiKey> = { empty: 'warnEmpty', pm: 'warnPm', clamp: 'warnClamp', overlap: 'warnOverlap', invalid: 'warnInvalid' }
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_ROWS = 40

const isParsed = (v: unknown): v is Parsed => !!v && Array.isArray((v as Parsed).courses)

export default function ImportTimetable({ lang, tableId }: { lang: Lang; tableId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** 인식할 때 서버가 보정·버린 내용(처음 고치기 전까지 보여 준다) */
  const [notes, setNotes] = useState<Warning[]>([])
  const [saving, startSave] = useTransition()
  const nextId = useRef(0)
  const newId = () => nextId.current++

  // 고친 내용으로 매번 다시 검사해서 경고·미리보기를 보여 준다(저장 때 서버도 같은 검사)
  const checked = useMemo(() => (rows ? normalizeParsed(rows) : null), [rows])
  const warnings = [...notes, ...(checked?.warnings ?? [])]
  const blocked = !rows?.length || !!checked?.warnings.some(w => w.code === 'invalid' || w.code === 'overlap')

  async function upload(file: File) {
    setError('')
    if ((file.type && !TYPES.includes(file.type)) || file.size > MAX_BYTES) { setError(t(lang, 'imageRule')); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/timetable/parse', { method: 'POST', body: fd })
      if (!res.ok) { setError(t(lang, res.status === 400 || res.status === 413 || res.status === 415 ? 'imageRule' : 'tryAgain')); return }
      const data: unknown = await res.json()
      if (!isParsed(data)) { setError(t(lang, 'tryAgain')); return }
      setNotes(Array.isArray(data.warnings) ? data.warnings.filter(w => w.code === 'pm' || w.code === 'clamp' || w.code === 'invalid') : [])
      setRows(data.courses.slice(0, MAX_ROWS).map(c => ({ id: newId(), name: c.name, place: c.place, day: c.day, start: fmtMin(c.start), end: fmtMin(c.end) })))
    } catch {
      setError(t(lang, 'tryAgain'))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!rows || blocked) return
    setError('')
    startSave(async () => {
      try {
        const r = await saveCourses(tableId, rows.map(({ name, place, day, start, end }) => ({ name, place, day, start, end })))
        if (r?.error) setError(t(lang, r.error === 'overlap' ? 'warnOverlap' : 'warnInvalid'))
      } catch {
        setError(t(lang, 'tryAgain'))
      }
    })
  }

  const change = (fn: (r: Row[]) => Row[]) => { setNotes([]); setRows(r => r && fn(r)) }
  const edit = (id: number, patch: Partial<Row>) => change(r => r.map(x => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id: number) => change(r => r.filter(x => x.id !== id))
  const add = () => {
    const row = { id: newId(), name: '', place: '', day: 0, start: '09:00', end: '10:00' }
    change(r => (r.length < MAX_ROWS ? [...r, row] : r))
  }
  // 16px 글자: iOS가 입력칸을 누를 때 화면을 확대하지 않게
  const field = 'h-11 min-w-0 rounded-xl bg-bg-soft px-3 text-[16px] outline-none focus:ring-2 focus:ring-navy/20'

  return (
    <div className="space-y-3 px-3 pb-40 pt-1">
      <label className={`rise press card flex cursor-pointer flex-col items-center gap-2 px-6 py-10 text-center focus-within:ring-2 focus-within:ring-navy/30 ${busy ? 'animate-pulse' : ''}`} aria-busy={busy}>
        <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-navy/8 text-navy" aria-hidden><Camera size={32} weight="fill" /></span>
        <span className="mt-1 text-[18px] font-bold">{busy ? t(lang, 'reading') : t(lang, 'chooseImage')}</span>
        <span className="text-[14px] text-muted">{t(lang, 'imageRule')}</span>
        <input
          type="file" accept={TYPES.join(',')} className="sr-only" disabled={busy || saving}
          onChange={e => {
            const file = e.target.files?.[0]
            // 같은 파일을 다시 골라도 onChange가 오도록 비운다
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
      </label>
      {error && <p role="alert" className="px-2 text-[14px] font-medium text-danger">{error}</p>}

      {rows && checked && (
        <>
          <p className="px-2 pt-2 text-[19px] font-bold tracking-tight">{t(lang, 'checkResult')}</p>
          {warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-2xl bg-danger/10 p-4 text-[14px] text-danger" aria-live="polite">
              {warnings.map((w, i) => <li key={`${w.code}-${w.name ?? ''}-${i}`} className="flex gap-1.5"><WarningIcon size={18} weight="fill" className="shrink-0" aria-hidden />{w.name ? `${w.name}: ` : ''}{t(lang, WARN[w.code])}</li>)}
            </ul>
          )}
          <TimetableGrid lang={lang} courses={checked.courses.map((c, i) => ({ key: String(i), ...c }))} />
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="card space-y-2 p-3">
                <div className="flex gap-1.5">
                  <input value={r.name} maxLength={NAME_MAX} onChange={e => edit(r.id, { name: e.target.value })} aria-label={t(lang, 'courseName')} autoComplete="off" enterKeyHint="next" className={`${field} flex-1 font-semibold`} />
                  <button type="button" onClick={() => remove(r.id)} aria-label={t(lang, 'delete')} className="press flex h-11 w-11 items-center justify-center rounded-xl text-danger"><X size={18} weight="bold" /></button>
                </div>
                <input value={r.place} maxLength={PLACE_MAX} onChange={e => edit(r.id, { place: e.target.value })} aria-label={t(lang, 'place')} autoComplete="off" enterKeyHint="next" className={`${field} w-full`} />
                {/* 요일은 한두 글자라 좁게, 시간 칸은 "오전 10:00"이 잘리지 않게 넓게 */}
                <div className="grid grid-cols-[5rem_1fr_1fr] gap-1.5">
                  <select value={r.day} onChange={e => edit(r.id, { day: Number(e.target.value) })} aria-label={t(lang, 'day')} className={field.replace('px-3', 'px-2')}>{Array.from({ length: DAYS }, (_, d) => <option key={d} value={d}>{dayName(d, lang)}</option>)}</select>
                  <input type="time" step={1800} value={r.start} onChange={e => edit(r.id, { start: e.target.value })} aria-label={t(lang, 'start')} className={field.replace('px-3', 'px-2')} />
                  <input type="time" step={1800} value={r.end} onChange={e => edit(r.id, { end: e.target.value })} aria-label={t(lang, 'end')} className={field.replace('px-3', 'px-2')} />
                </div>
              </li>
            ))}
          </ul>
          {rows.length < MAX_ROWS && <button type="button" onClick={add} className={`${btn.soft} bg-bg`}><Plus size={18} weight="bold" />{t(lang, 'add')}</button>}
          <BottomCTA><button type="button" disabled={saving || blocked} onClick={save} className={btn.primary}>{t(lang, 'save')}</button></BottomCTA>
        </>
      )}
    </div>
  )
}

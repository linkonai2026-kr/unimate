// 수업 찾기: 과목명·교수·코드 검색, 구분·학점·요일 필터, 겹치는 수업 숨기기, 담기·빼기, 직접 일정
import { BookOpen, Camera, MagnifyingGlass, Prohibit, Star } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { addFromCatalog, removeItem } from '@/app/timetable-actions'
import CustomForm from '@/components/CustomForm'
import { Empty, IconBox, Section, btn, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { dayName, t } from '@/lib/i18n'
import { reviewSummary } from '@/lib/reviews'
import { getStore } from '@/lib/store'
import type { Review } from '@/lib/types'
import { clash, filterCatalog, type CatalogFilter } from '@/lib/timetable/catalog'
import { DAYS, fmtMin, isDay } from '@/lib/timetable/slots'
import { resolveTable } from '@/lib/timetable/view'

const CREDITS = [1, 2, 3]
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

export default async function AddCoursePage({ searchParams }: PageProps<'/timetable/add'>) {
  const me = await requireUser()
  const lang = me.lang
  const sp = await searchParams
  const { table, courses } = await resolveTable(me.id, sp)
  const store = getStore()
  const [catalog, reviews] = await Promise.all([store.listCatalog(), store.listReviews()])
  // 주소의 필터 값은 아무 값이나 올 수 있으니 허용된 값만 쓴다
  const type = one(sp.type), credit = Number(one(sp.credit)), day = one(sp.day) === '' ? NaN : Number(one(sp.day))
  const f: CatalogFilter = {
    q: one(sp.q).slice(0, 50),
    type: type === 'major' || type === 'general' ? type : '',
    credit: CREDITS.includes(credit) ? credit : undefined,
    day: isDay(day) ? day : undefined,
    hideClash: one(sp.hide) === 'on',
  }
  const list = filterCatalog(catalog, f, courses)
  const added = new Set(courses.map(c => c.code).filter(Boolean))
  const byCourse = new Map<string, Review[]>()
  for (const r of reviews) byCourse.set(r.courseName, [...(byCourse.get(r.courseName) ?? []), r])
  // 담기·빼기 뒤 같은 검색 화면으로 돌아오도록 지금 주소(t는 실제 시간표 id로)
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0] !== 't'))
  qs.set('t', table.id)
  const here = `/timetable/add?${qs}`
  // 16px 글자: iOS가 셀렉트를 누를 때 화면을 확대하지 않게
  const chip = 'h-11 w-full min-w-0 truncate rounded-xl bg-bg-soft px-2 text-[16px] font-medium outline-none'

  return (
    <div className="space-y-3 pb-6 pt-1">
      <form role="search" className="rise card mx-3 space-y-3 p-4">
        <input type="hidden" name="t" value={table.id} />
        <label className="relative block">
          <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" type="search" defaultValue={f.q} maxLength={50} aria-label={t(lang, 'searchCourses')} placeholder={t(lang, 'searchCourses')} autoComplete="off" enterKeyHint="search" className={`${field} pl-11`} />
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <select name="type" defaultValue={f.type} aria-label={t(lang, 'typeAll')} className={chip}><option value="">{t(lang, 'typeAll')}</option><option value="major">{t(lang, 'major')}</option><option value="general">{t(lang, 'general')}</option></select>
          <select name="credit" defaultValue={f.credit ?? ''} aria-label={t(lang, 'creditAll')} className={chip}><option value="">{t(lang, 'creditAll')}</option>{CREDITS.map(n => <option key={n} value={n}>{t(lang, 'creditsN', { n: String(n) })}</option>)}</select>
          <select name="day" defaultValue={f.day ?? ''} aria-label={t(lang, 'dayAll')} className={chip}><option value="">{t(lang, 'dayAll')}</option>{Array.from({ length: DAYS }, (_, d) => <option key={d} value={d}>{dayName(d, lang)}</option>)}</select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-11 items-center gap-2 py-2 text-[14px]"><input type="checkbox" name="hide" defaultChecked={f.hideClash} className="h-5 w-5 shrink-0 accent-[var(--teal)]" />{t(lang, 'hideClash')}</label>
          <button className={btn.smallPrimary}>{t(lang, 'search')}</button>
        </div>
      </form>

      <Section>
        <CustomForm tableId={table.id} lang={lang} open={one(sp.custom) === '1'} />
        <Link href={`/timetable/import?t=${encodeURIComponent(table.id)}`} className="tap flex items-center gap-3 px-5 py-4">
          <IconBox tone="navy"><Camera size={22} weight="fill" /></IconBox><span className="text-[16px] font-semibold">{t(lang, 'importCapture')}</span>
        </Link>
      </Section>

      <Section title={<span>{t(lang, 'findCourses')} <span className="text-[14px] font-medium text-muted">{list.length}</span></span>}>
        <ul className="pb-2">
          {list.map(c => {
            const has = added.has(c.code)
            const blocked = !has && clash(courses, c.slots)
            const rs = reviewSummary(byCourse.get(c.name) ?? [])
            return (
              <li key={c.code} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold">{c.name}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{c.prof || t(lang, 'profTbd')} · {t(lang, 'creditsN', { n: String(c.credit) })} · {t(lang, c.type === 'major' ? 'major' : 'general')}</p>
                  <p className="text-[13px] text-muted">{[...new Set(c.slots.map(s => `${dayName(s.day, lang)} ${fmtMin(s.start)}–${fmtMin(s.end)}`))].join(', ')}</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px]">
                    {rs.count > 0 && <span className="inline-flex items-center gap-0.5 font-semibold text-[#b07f00]"><Star size={12} weight="fill" aria-hidden />{rs.avg} ({rs.count})</span>}
                    <Link href={`/lectures/${encodeURIComponent(c.name)}`} className="-my-2 inline-flex min-h-11 items-center gap-0.5 px-1 text-[13px] text-muted"><BookOpen size={12} aria-hidden />{t(lang, 'reviews')}</Link>
                  </p>
                </div>
                {has
                  ? <form action={removeItem.bind(null, table.id, c.code, here)}><button className={btn.small}>{t(lang, 'remove')}</button></form>
                  : blocked
                    ? <span className="inline-flex items-center gap-1 rounded-xl bg-danger/10 px-2.5 py-2 text-[13px] font-semibold text-danger"><Prohibit size={14} weight="bold" aria-hidden />{t(lang, 'clashLabel')}</span>
                    : <form action={addFromCatalog.bind(null, table.id, c.code, here)}><button className="press inline-flex min-h-11 items-center rounded-xl bg-teal px-3.5 text-[14px] font-bold text-white">{t(lang, 'add')}</button></form>}
              </li>
            )
          })}
        </ul>
        {list.length === 0 && <Empty icon={<MagnifyingGlass size={28} />} title={t(lang, 'noData')} />}
      </Section>
    </div>
  )
}

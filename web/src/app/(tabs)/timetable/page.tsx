// 시간표: 학기·시간표 고르기, ＋(수업 찾기)·설정·목록, 격자, 학점계산기, 친구 검색과 공강 추천
import { CaretDown, CaretRight, GearSix, ListBullets, MagnifyingGlass, NavigationArrow, Plus, Star, Trash, UserPlus, UsersThree } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { createTable, makePrimary, removeItem, removeTable, renameTable, setColor } from '@/app/timetable-actions'
import Avatar from '@/components/Avatar'
import TimetableGrid, { PALETTE, colorIndex } from '@/components/TimetableGrid'
import { Flag, IconBox, Row, Section, Sheet, btn, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { dayName, t, type Lang } from '@/lib/i18n'
import { buildingById } from '@/lib/map/buildings'
import { getStore } from '@/lib/store'
import { isCustomCode } from '@/lib/timetable/catalog'
import { gpa } from '@/lib/timetable/grades'
import { parsePlace } from '@/lib/timetable/rooms'
import { SEMS } from '@/lib/timetable/sem'
import { fmtMin } from '@/lib/timetable/slots'
import { groupItems, keyOf, resolveTable, type TableItem } from '@/lib/timetable/view'

const circle = 'press flex h-10 w-10 items-center justify-center rounded-full bg-bg text-ink'
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')
const slotsText = (i: TableItem, lang: Lang) => i.slots.map(s => `${dayName(s.day, lang)} ${fmtMin(s.start)}–${fmtMin(s.end)}`).join(', ')
const credit = (i: TableItem) => (Number.isFinite(i.credit) && i.credit! > 0 ? i.credit! : 0)

export default async function TimetablePage({ searchParams }: PageProps<'/timetable'>) {
  const me = await requireUser()
  const lang = me.lang
  const sp = await searchParams
  const { sem, tables, table, courses } = await resolveTable(me.id, sp)
  const store = getStore()
  const [grades, friends] = await Promise.all([store.getGrades(me.id), store.listFriends(me.id)])
  const items = groupItems(courses)
  const credits = items.reduce((n, i) => n + credit(i), 0)
  const g = gpa(grades)
  const fq = one(sp.fq).trim().slice(0, 40)
  const fql = fq.toLowerCase()
  const shownFriends = fq ? friends.filter(f => f.nickname.toLowerCase().includes(fql) || f.handle.includes(fql.replace(/^@/, ''))) : friends
  const here = `/timetable?t=${encodeURIComponent(table.id)}`
  const itemHref = (key: string) => `${here}&c=${encodeURIComponent(key)}`
  const open = items.find(i => i.key === one(sp.c))
  const room = open ? parsePlace(open.place) : null
  const building = buildingById(room?.buildingId)
  const sheet = one(sp.sheet)
  const primaryTag = <span className="rounded-md bg-mint-soft px-1.5 py-0.5 text-[11px] font-bold text-mint-text">{t(lang, 'primaryTag')}</span>

  return (
    <div className="space-y-3 pb-6 pt-1">
      <div className="rise flex items-center gap-2 px-4">
        <Link href={`${here}&sheet=tables`} scroll={false} className="press min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-teal">{sem}</p>
          <p className="flex items-center gap-1.5 text-[20px] font-bold tracking-tight">
            <span className="truncate">{table.name}</span>
            {table.primary && primaryTag}
            <CaretDown size={16} weight="bold" className="shrink-0 text-muted" aria-hidden />
          </p>
        </Link>
        <Link href={`/timetable/add?t=${encodeURIComponent(table.id)}`} aria-label={t(lang, 'findCourses')} className={circle}><Plus size={20} weight="bold" aria-hidden /></Link>
        <Link href={`${here}&sheet=settings`} scroll={false} aria-label={t(lang, 'tableSettings')} className={circle}><GearSix size={20} aria-hidden /></Link>
        <Link href={`${here}&sheet=list`} scroll={false} aria-label={t(lang, 'listView')} className={circle}><ListBullets size={20} aria-hidden /></Link>
      </div>

      <div className="rise mx-3">
        <TimetableGrid lang={lang} courses={courses.map(c => ({ key: c.id, name: c.name, place: c.place, day: c.day, start: c.start, end: c.end, href: itemHref(keyOf(c)), highlight: keyOf(c) === open?.key, color: table.colors[keyOf(c)] }))} />
        <p className="mt-2 px-2 text-[13px] text-muted">
          {items.length
            ? <><b className="font-semibold text-ink">{t(lang, 'coursesN', { n: String(items.length) })} · {t(lang, 'creditsN', { n: String(credits) })}</b> · {t(lang, 'visibleToFriends')}</>
            : t(lang, 'emptyTable')}
        </p>
      </div>

      <Link href="/calc" className="rise press card mx-3 block p-5">
        <p className="flex items-center justify-between text-[17px] font-bold">{t(lang, 'gpaCalc')}<CaretRight size={18} weight="bold" className="text-[#c4c9d2]" aria-hidden /></p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-bg-soft px-4 py-3">
            <p className="text-[13px] text-muted">{t(lang, 'avgGrade')}</p>
            <p className="mt-0.5 text-[24px] font-bold tracking-tight text-navy">{g.avg.toFixed(2)}<span className="text-[14px] font-medium text-muted"> / 4.5</span></p>
          </div>
          <div className="rounded-2xl bg-bg-soft px-4 py-3">
            <p className="text-[13px] text-muted">{t(lang, 'earnedCredits')}</p>
            <p className="mt-0.5 text-[24px] font-bold tracking-tight text-navy">{g.credits}<span className="text-[14px] font-medium text-muted"> / 130</span></p>
          </div>
        </div>
      </Link>

      <Section title={t(lang, 'friends')}>
        <div className="px-5 pt-2">
          <form action="/timetable" role="search" className="relative">
            <input type="hidden" name="t" value={table.id} />
            <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input name="fq" type="search" defaultValue={fq} maxLength={40} aria-label={t(lang, 'friendSearch')} placeholder={t(lang, 'friendSearch')} className={`${field} h-12 pl-11`} />
          </form>
        </div>
        <ul className="py-2">
          <li><Row href="/friends" icon={<IconBox tone="teal"><UsersThree size={22} weight="fill" /></IconBox>} title={t(lang, 'freeTogether')} /></li>
          <li><Row href="/friends" icon={<IconBox tone="navy"><UserPlus size={22} weight="fill" /></IconBox>} title={t(lang, 'addFriend')} /></li>
          {shownFriends.map(f => (
            <li key={f.id}><Row href={`/friends/${f.handle}`} icon={<Avatar n={f.avatar ?? 0} photo={f.photo} size={40} />} title={<span className="flex items-center gap-1.5">{f.nickname}<Flag code={f.nationality} size={12} /></span>} sub={`@${f.handle}`} /></li>
          ))}
        </ul>
      </Section>

      {open && (
        <Sheet close={here}>
          <p className="text-[22px] font-bold tracking-tight">{open.name}</p>
          <p className="mt-1 text-[15px] text-muted">{[open.prof || (open.code && !isCustomCode(open.code) ? t(lang, 'profTbd') : ''), credit(open) ? t(lang, 'creditsN', { n: String(credit(open)) }) : ''].filter(Boolean).join(' · ')}</p>
          <p className="mt-3 rounded-2xl bg-bg-soft px-4 py-3 text-[15px]">{slotsText(open, lang)}{open.place && <span className="mt-0.5 block text-muted">{open.place}</span>}</p>
          {room?.buildingId && building
            ? <Link href={`/map?b=${encodeURIComponent(room.buildingId)}${room.roomNo ? `&room=${encodeURIComponent(room.roomNo)}` : ''}&go=1`} className={`${btn.mint} mt-4`}><NavigationArrow size={20} weight="fill" aria-hidden />{t(lang, 'route')} · {building.name}</Link>
            : <span className={`${btn.soft} mt-4 text-muted`} aria-disabled="true">{t(lang, 'route')}</span>}
          <Link href={`/lectures/${encodeURIComponent(open.name)}`} className={`${btn.soft} mt-2`}><Star size={18} weight="fill" className="text-[#b07f00]" aria-hidden />{t(lang, 'reviews')}</Link>
          <p className="mt-5 text-[13px] font-semibold text-muted">{t(lang, 'color')}</p>
          <div className="mt-2 flex justify-between">
            {PALETTE.map((hex, i) => {
              const on = (table.colors[open.key] ?? colorIndex(open.name)) === i
              return <form key={hex} action={setColor.bind(null, table.id, open.key, i)}><button aria-label={`${t(lang, 'color')} ${i + 1}`} aria-pressed={on} className={`press h-9 w-9 rounded-full ${on ? 'ring-2 ring-navy ring-offset-2' : ''}`} style={{ background: hex }} /></form>
            })}
          </div>
          <form action={removeItem.bind(null, table.id, open.key, here)} className="mt-4"><button className="press flex w-full items-center justify-center gap-1.5 py-3 text-[15px] font-semibold text-danger"><Trash size={18} aria-hidden />{t(lang, 'removeFromTable')}</button></form>
        </Sheet>
      )}

      {sheet === 'tables' && (
        <Sheet close={here}>
          <p className="text-[13px] font-semibold text-muted">{t(lang, 'semester')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SEMS.map(s => <Link key={s} href={`/timetable?sem=${encodeURIComponent(s)}&sheet=tables`} scroll={false} aria-current={s === sem ? 'true' : undefined} className={`press rounded-full px-3.5 py-2 text-[14px] font-semibold ${s === sem ? 'bg-navy text-white' : 'bg-bg-soft'}`}>{s}</Link>)}
          </div>
          <ul className="mt-4 overflow-hidden rounded-2xl bg-bg-soft">
            {tables.map(x => (
              <li key={x.id}><Link href={`/timetable?t=${encodeURIComponent(x.id)}`} aria-current={x.id === table.id ? 'true' : undefined} className={`tap flex min-h-14 items-center gap-2 px-4 ${x.id === table.id ? 'font-bold text-navy' : ''}`}>{x.name}{x.primary && primaryTag}</Link></li>
            ))}
          </ul>
          <form action={createTable.bind(null, sem)} className="mt-3 flex gap-2">
            <input name="name" maxLength={20} aria-label={t(lang, 'tableName')} placeholder={t(lang, 'tableName')} className={`${field} h-12 flex-1`} />
            <button className={`${btn.smallPrimary} h-12 rounded-2xl px-4`}><Plus size={16} weight="bold" aria-hidden />{t(lang, 'newTable')}</button>
          </form>
        </Sheet>
      )}

      {sheet === 'settings' && (
        <Sheet close={here}>
          <form action={renameTable.bind(null, table.id)} className="flex gap-2">
            <input name="name" defaultValue={table.name} required maxLength={20} aria-label={t(lang, 'tableName')} className={`${field} h-12 flex-1`} />
            <button className={`${btn.small} h-12 rounded-2xl px-4`}>{t(lang, 'rename')}</button>
          </form>
          <div className="mt-3 overflow-hidden rounded-2xl bg-bg-soft">
            {!table.primary && <form action={makePrimary.bind(null, table.id)}><button className="tap flex min-h-14 w-full items-center px-4 text-left text-[16px]">{t(lang, 'setPrimary')}</button></form>}
            <Link href={`/timetable/import?t=${encodeURIComponent(table.id)}`} className="tap flex min-h-14 items-center px-4 text-[16px]">{t(lang, 'importCapture')}</Link>
            <Link href={`/timetable/add?t=${encodeURIComponent(table.id)}&custom=1`} className="tap flex min-h-14 items-center px-4 text-[16px]">{t(lang, 'customSchedule')}</Link>
            {tables.length > 1 && <form action={removeTable.bind(null, table.id)}><button className="tap flex min-h-14 w-full items-center px-4 text-left text-[16px] text-danger">{t(lang, 'deleteTable')}</button></form>}
          </div>
        </Sheet>
      )}

      {sheet === 'list' && (
        <Sheet close={here}>
          <p className="text-[19px] font-bold">{table.name} <span className="text-[15px] font-medium text-muted">{t(lang, 'creditsN', { n: String(credits) })}</span></p>
          <ul className="mt-3 max-h-[50vh] overflow-y-auto">
            {items.map(i => (
              <li key={i.key}><Row href={itemHref(i.key)} title={<span>{i.name} <span className="text-[13px] font-normal text-muted">{credit(i) ? t(lang, 'creditsN', { n: String(credit(i)) }) : ''}</span></span>} sub={[slotsText(i, lang), i.place].filter(Boolean).join(' · ')} /></li>
            ))}
            {items.length === 0 && <li className="py-6 text-center text-[15px] text-muted">{t(lang, 'emptyTable')}</li>}
          </ul>
        </Sheet>
      )}
    </div>
  )
}

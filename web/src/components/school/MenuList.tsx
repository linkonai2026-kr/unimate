// 이번 주 학식 목록(학생 화면·방문객 화면 공통). 늘 학교 사이트에서 새로 받고, 오늘(한국)을 강조, 운영하지 않는 끼니는 뺀다
import { ArrowSquareOut, WarningCircle } from '@phosphor-icons/react/dist/ssr'
import { DayRefresh, RefreshButton } from '@/components/BottomNav'
import { dayName, t, type Lang } from '@/lib/i18n'
import { kstDay } from '@/lib/school/memo'
import { MENU_URL, mealLabel, servedOn, todayIndex } from '@/lib/school/menu'
import { menuView } from '@/lib/school/service'

/** 학교 사이트의 날짜 머리글("11.02(월)")의 한국어 요일을 화면 언어 요일로 */
const KO_DAYS = '월화수목금토일'
const dayHead = (d: string, lang: Lang) => (lang === 'ko' ? d : d.replace(/\(([월화수목금토일])\)/,(_, k: string) => `(${dayName(KO_DAYS.indexOf(k), lang)})`))

/** 식단을 못 받았을 때: 옛 정보 대신 분명한 안내, 다시 시도, 학교 사이트 바로 가기 */
export function MenuError({ lang }: { lang: Lang }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <WarningCircle size={36} weight="fill" className="text-danger" aria-hidden />
      <p className="text-[16px] font-bold">{t(lang, 'menuError')}</p>
      <RefreshButton label={t(lang, 'retry')} />
      <a href={MENU_URL} target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-1 text-[14px] font-semibold text-muted">
        {t(lang, 'viewOriginalSite')}<ArrowSquareOut size={14} aria-hidden />
      </a>
    </div>
  )
}

/** 받아 둔 식단을 보여 줄 때의 안내(한국 시각) */
export function MenuCachedNote({ lang, at }: { lang: Lang; at: number }) {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(at)
  return <p role="status" className="mx-3 rounded-2xl bg-danger/8 px-4 py-2.5 text-[13px] font-medium text-danger">{t(lang, 'menuCached', { time })}</p>
}

export default async function MenuList({ lang }: { lang: Lang }) {
  const view = await menuView(lang)
  const { week } = view
  const day = kstDay().iso
  if (!week) return <div className="pb-6 pt-1"><DayRefresh day={day} /><div className="rise card mx-3"><MenuError lang={lang} /></div></div>
  const today = todayIndex(week.days)
  return (
    <div className="space-y-3 pb-6 pt-1">
      <DayRefresh day={day} />
      {view.source === 'cached' && <MenuCachedNote lang={lang} at={view.at} />}
      <p className="rise px-5 text-[15px] font-semibold text-muted">{week.restaurant}</p>
      {/* 주말이면 오늘 열이 없다(다음 주 식단을 보여 준다) */}
      {today < 0 && <p className="px-5 text-[14px] text-muted">{t(lang, 'noMenuToday')}</p>}
      {week.days.map((d, i) => {
        const meals = week.corners.flatMap(c => c.meals.map(m => ({ c, m, items: servedOn(m.byDay, i) })).filter(x => x.items.length > 0))
        return (
          <section key={`${i}-${d}`} aria-current={i === today ? 'date' : undefined} className={`rise card mx-3 p-5 ${i === today ? 'ring-2 ring-teal' : ''}`}>
            <h2 className="flex items-center gap-2 text-[18px] font-bold">{dayHead(d, lang)}{i === today && <span className="rounded-md bg-teal px-1.5 py-0.5 text-[11px] font-bold text-white">{t(lang, 'today')}</span>}</h2>
            {i === today && meals.length === 0 && <p className="mt-3 text-[15px] text-muted">{t(lang, 'noMenuToday')}</p>}
            {meals.length > 0 && (
              <ul className="mt-3 space-y-2">
                {meals.map(({ c, m, items }, k) => {
                  const shown = items.map(x => week.tr[x] ?? x).join(', '), original = items.join(', ')
                  return (
                  <li key={`${c.name}-${m.meal}-${k}`} className="rounded-2xl bg-bg-soft px-4 py-3">
                    <p className="flex justify-between gap-2 text-[13px] font-semibold text-mint-text"><span>{mealLabel(m.meal, lang)} · {week.tr[c.name] ?? c.name}</span>{c.price && <span className="shrink-0 text-muted">{c.price}</span>}</p>
                    <p className="mt-1 text-[15px] font-medium leading-snug">{shown}</p>
                    {/* 번역됐을 때만 원문을 덧붙인다(번역이 없으면 같은 줄이 두 번 보인다) */}
                    {lang !== 'ko' && shown !== original && <p lang="ko" className="mt-0.5 text-[12px] text-muted">{original}</p>}
                  </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
      <p className="px-5 text-[12px] text-[#8b93a1]">{t(lang, 'weekMenu')} · kangwon.ac.kr</p>
    </div>
  )
}

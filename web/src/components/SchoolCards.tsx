// 홈의 학사공지·오늘의 학식 덩어리(학교 사이트 실제 정보, 한국 날짜 기준, 느린 요청은 Suspense 안에서)
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr'
import { MenuCachedNote, MenuError } from '@/components/school/MenuList'
import { Row, Section } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'
import { currentMeal, mealLabel, servedOn, todayIndex } from '@/lib/school/menu'
import { menuView, noticeCards } from '@/lib/school/service'

/** 오늘 올라온 글 표시 */
export const TodayBadge = ({ lang }: { lang: Lang }) => <span className="mr-1.5 inline-block rounded-md bg-danger px-1.5 py-0.5 align-[2px] text-[11px] font-bold text-white">{t(lang, 'today')}</span>

export async function NoticeCard({ lang }: { lang: Lang }) {
  const { items, source } = await noticeCards('academic', lang, 3)
  return (
    <Section title={t(lang, 'notices')} more="/notices" moreLabel={source === 'snapshot' ? t(lang, 'snapshot') : t(lang, 'more')}>
      {items.length === 0 && <p className="px-5 pb-5 pt-2 text-[14px] text-muted">{t(lang, 'noData')}</p>}
      <ul className="pb-2">
        {items.map(n => (
          <li key={n.id}>
            <Row href="/notices" title={<>{n.isToday && <TodayBadge lang={lang} />}{n.titleTr}</>} sub={[n.date, n.dept].filter(Boolean).join(' · ')} chevron={false}
              right={n.deadline ? <span className="rounded-lg bg-danger/10 px-2 py-1 text-[12px] font-bold text-danger">{t(lang, 'deadline')} {n.dday ?? n.deadline}</span> : undefined} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function MenuCard({ lang }: { lang: Lang }) {
  const view = await menuView(lang)
  const { week } = view
  const title = <span>{t(lang, 'todayMenu')} {week && <span className="text-[14px] font-medium text-muted">{week.restaurant.replace('삼척-', '')}</span>}</span>
  if (!week) return <Section title={title} more="/menu" moreLabel={t(lang, 'weekMenu')}><MenuError lang={lang} /></Section>
  // 오늘(한국) 열. 주말이면 없다
  const day = todayIndex(week.days)
  const want = currentMeal()
  // 오늘 나오는 끼니(운영 안 함은 뺀다). 지금 끼니가 없으면(예: 저녁 운영 안 함) 오늘 나오는 다른 끼니를 보여 준다
  const meals = week.corners.flatMap(c => c.meals.map(m => ({ c, m, items: servedOn(m.byDay, day) })).filter(x => x.items.length > 0))
  const now = meals.filter(x => x.m.meal === want)
  const shown = now.length ? now : meals.slice(0, 3)
  return (
    <Section title={title} more="/menu" moreLabel={t(lang, 'weekMenu')}>
      {view.source === 'cached' && <div className="pt-2"><MenuCachedNote lang={lang} at={view.at} /></div>}
      {shown.length === 0 ? (
        <div className="flex items-center gap-2 px-5 pb-5 pt-2 text-[15px] text-muted"><CalendarBlank size={20} aria-hidden />{t(lang, 'noMenuToday')}</div>
      ) : (
        <ul className="space-y-2 px-5 pb-5 pt-2">
          {shown.map(({ c, m, items }, i) => (
            <li key={`${c.name}-${m.meal}-${i}`} className="rounded-2xl bg-bg-soft px-4 py-3">
              <p className="flex items-center justify-between text-[13px] font-semibold text-mint-text">
                <span>{mealLabel(m.meal, lang)} · {week.tr[c.name] ?? c.name}</span>{c.price && <span className="text-muted">{c.price}</span>}
              </p>
              <p className="mt-1 text-[16px] font-semibold leading-snug">{items.map(x => week.tr[x] ?? x).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

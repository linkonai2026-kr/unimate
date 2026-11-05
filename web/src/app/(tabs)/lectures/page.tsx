// 강의평가 목록: 평가가 있는 과목과 내 시간표 과목
import { BookOpen, MagnifyingGlass, Star } from '@phosphor-icons/react/dist/ssr'
import { Empty, IconBox, Row, Section, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { cleanInput } from '@/lib/board/flow'
import { t } from '@/lib/i18n'
import { REVIEW_LIMITS, reviewSummary } from '@/lib/reviews'
import { getStore } from '@/lib/store'
import type { Review } from '@/lib/types'

export default async function LecturesPage({ searchParams }: PageProps<'/lectures'>) {
  const me = await requireUser()
  const lang = me.lang
  const raw = (await searchParams).q
  const q = cleanInput(Array.isArray(raw) ? raw[0] : raw, REVIEW_LIMITS.courseName)
  const needle = q.toLowerCase()
  const store = getStore()
  const [reviews, mine] = await Promise.all([store.listReviews(), store.listCourses(me.id)])
  const mineSet = new Set(mine.map(c => c.name))
  // 과목별로 한 번만 묶는다(과목 수 × 평가 수만큼 다시 거르지 않게)
  const byCourse = new Map<string, Review[]>()
  for (const r of reviews) byCourse.set(r.courseName, [...(byCourse.get(r.courseName) ?? []), r])
  const names = [...new Set([...mineSet, ...byCourse.keys()])].filter(n => !needle || n.toLowerCase().includes(needle))
  return (
    <div className="space-y-3 pb-6 pt-1">
      <form role="search" className="px-3">
        <label className="relative block">
          <span className="sr-only">{t(lang, 'searchCourse')}</span>
          <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" name="q" defaultValue={q} maxLength={REVIEW_LIMITS.courseName} enterKeyHint="search" autoComplete="off" placeholder={t(lang, 'searchCourse')} className={`${field} bg-bg pl-11`} />
        </label>
      </form>
      <Section>
        {names.length === 0 ? <Empty icon={<BookOpen size={28} />} title={t(lang, 'noData')} /> : (
          <ul className="py-2">
            {names.map(n => {
              const s = reviewSummary(byCourse.get(n) ?? [])
              return (
                <li key={n}>
                  <Row href={`/lectures/${encodeURIComponent(n)}`} icon={<IconBox tone={mineSet.has(n) ? 'mint' : 'gray'}><BookOpen size={22} weight="fill" /></IconBox>}
                    title={n} sub={mineSet.has(n) ? t(lang, 'myCourses') : undefined}
                    right={s.count > 0 ? <span className="inline-flex items-center gap-0.5 font-semibold text-[#b07f00]"><Star size={14} weight="fill" aria-hidden />{s.avg} <span className="font-normal text-muted">({s.count})</span></span> : <span className="text-teal">{t(lang, 'writeReview')}</span>} />
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

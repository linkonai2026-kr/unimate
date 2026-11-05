// 과목별 강의평가: 큰 평균 별점, 항목별 막대, 번역된 평가 목록, 작성 폼
import { Star } from '@phosphor-icons/react/dist/ssr'
import { notFound } from 'next/navigation'
import { submitReview } from '@/app/review-actions'
import Avatar from '@/components/Avatar'
import LiveRefresh from '@/components/LiveRefresh'
import TrText from '@/components/TrText'
import { Flag, Section, btn, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { cleanInput, isPending } from '@/lib/board/flow'
import { t } from '@/lib/i18n'
import { REVIEW_FIELDS, REVIEW_LIMITS, reviewSummary } from '@/lib/reviews'
import { getStore } from '@/lib/store'
import { pickText } from '@/lib/text'
import { timeAgo } from '@/lib/time'
import type { Profile } from '@/lib/types'

const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <span role="img" className="inline-flex text-[#f5b400]" aria-label={`${n}/5`}>{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} weight={i <= n ? 'fill' : 'regular'} aria-hidden />)}</span>
)

/** 주소의 과목명: Next가 인코딩해 넘기므로 한 번 풀되, 잘못된 % 표기여도 화면이 깨지지 않게 */
function courseFromParam(raw: string): string {
  let s = raw
  try { s = decodeURIComponent(raw) } catch { /* 그대로 쓴다 */ }
  return cleanInput(s, 200)
}

export default async function LecturePage({ params }: PageProps<'/lectures/[name]'>) {
  const name = courseFromParam((await params).name)
  if (!name) notFound()
  // 평가는 과목명 40자까지만 저장된다(더 긴 이름은 목록만 보여 준다)
  const canWrite = name.length <= REVIEW_LIMITS.courseName
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const reviews = await store.listReviews(name)
  const s = reviewSummary(reviews)
  // 같은 작성자의 프로필은 한 번만 읽는다(국기만 쓰고 이름은 내보내지 않는다)
  const authorIds = [...new Set(reviews.map(r => r.authorId))]
  const profiles = new Map<string, Profile | null>(await Promise.all(authorIds.map(async id => [id, await store.getProfile(id)] as const)))
  const professor = reviews.find(r => r.professor)?.professor ?? ''
  return (
    <div className="space-y-3 pb-6 pt-1">
      <LiveRefresh topics={[`reviews:${name}`]} />
      <section className="rise card mx-3 p-5">
        <h2 className="text-[22px] font-bold tracking-tight">{name}</h2>
        {professor && <p className="mt-0.5 text-[14px] text-muted">{t(lang, 'professor')} {professor}</p>}
        {s.count > 0 && (
          <>
            <p className="mt-4 flex items-end gap-2"><span className="text-[40px] font-bold leading-none tracking-tight">{s.avg}</span><span className="pb-1"><Stars n={Math.round(s.avg)} size={18} /></span><span className="pb-1 text-[14px] text-muted">{s.count}</span></p>
            <div className="mt-4 space-y-2.5">
              {REVIEW_FIELDS.map(f => {
                const counts = s.fields[f.key]
                const top = counts && Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
                if (!top) return null
                const opt = f.options.find(o => o.value === top[0])
                return (
                  <div key={f.key} className="flex items-center gap-3 text-[14px]">
                    <span className="w-16 shrink-0 text-muted">{f.label[lang]}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg-soft" aria-hidden><span className="block h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (top[1] / s.count) * 100)}%` }} /></span>
                    <span className="w-24 shrink-0 text-right font-semibold">{opt?.label[lang] ?? top[0]}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {reviews.length > 0 && (
        <Section>
          <ul className="divide-y divide-line/70">
            {reviews.map(r => {
              const p = pickText(r, 'body', r.body, lang)
              const a = profiles.get(r.authorId)
              return (
                <li key={r.id} className="px-5 py-4">
                  <p className="flex items-center gap-2 text-[13px] text-muted"><Avatar size={22} /><Stars n={r.rating} />{a && <Flag code={a.nationality} size={11} />}<span>{timeAgo(r.createdAt, lang)}</span></p>
                  <div className="mt-2 text-[15px] leading-relaxed"><TrText text={p.text} original={r.body} translated={p.translated} pending={lang !== r.lang && isPending(r)} from={r.lang} viewer={lang} /></div>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {canWrite && <Section title={t(lang, 'writeReview')}>
        <form action={submitReview.bind(null, name)} className="space-y-3 px-5 pb-5 pt-3">
          <fieldset className="grid grid-cols-5 gap-1.5">
            <legend className="sr-only">{t(lang, 'rating')}</legend>
            {[1, 2, 3, 4, 5].map(n => (
              <label key={n} className="press flex h-12 cursor-pointer items-center justify-center gap-0.5 rounded-2xl bg-bg-soft text-[15px] font-semibold has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy/40">
                <input type="radio" name="rating" value={n} required defaultChecked={n === 5} className="sr-only" /><Star size={14} weight="fill" aria-hidden />{n}
              </label>
            ))}
          </fieldset>
          <input name="professor" maxLength={REVIEW_LIMITS.professor} autoComplete="off" aria-label={t(lang, 'professor')} placeholder={t(lang, 'professor')} defaultValue={professor} className={field} />
          <div className="grid grid-cols-2 gap-2">
            {REVIEW_FIELDS.map(f => (
              <label key={f.key} className="space-y-1 text-[13px] font-semibold text-muted">{f.label[lang]}
                <select name={f.key} defaultValue="" className={`${field} h-12 font-medium text-ink`}>
                  <option value="">-</option>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
                </select>
              </label>
            ))}
          </div>
          <textarea name="body" required maxLength={REVIEW_LIMITS.body} rows={4} aria-label={t(lang, 'reviewPlaceholder')} placeholder={t(lang, 'reviewPlaceholder')} className="w-full resize-none rounded-2xl bg-bg-soft p-4 text-[16px] outline-none placeholder:text-[#a4abb8] focus:ring-2 focus:ring-navy/20" />
          <button className={btn.primary}>{t(lang, 'submit')}</button>
        </form>
      </Section>}
    </div>
  )
}

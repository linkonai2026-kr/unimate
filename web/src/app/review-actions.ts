'use server'
// 강의평가 작성 서버 액션(검증 → 저장 → 실시간 알림 → 응답 후 번역)
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { cleanInput, translateLater } from '@/lib/board/flow'
import { flowDeps } from '@/lib/board/deps'
import { createLimiter } from '@/lib/rate-limit'
import { REVIEW_FIELDS, REVIEW_LIMITS, validateReview } from '@/lib/reviews'

// 사람마다 도배 제한(프로세스 메모리)
const reviewLimit = createLimiter({ limit: 5, windowMs: 10 * 60_000 })

export async function submitReview(courseName: string, f: FormData) {
  const me = await requireUser()
  const rating = cleanInput(f.get('rating'), 8)
  const input = {
    // 자르지 않는다: 긴 이름을 잘라 다른 과목에 평가가 붙지 않게, 길면 검증에서 거부
    courseName: cleanInput(courseName, 200),
    professor: cleanInput(f.get('professor'), REVIEW_LIMITS.professor),
    rating: /^[1-5]$/.test(rating) ? Number(rating) : NaN,
    // 고르지 않은 항목('-')은 빼고, 정해진 항목 키만 읽는다
    fields: Object.fromEntries(REVIEW_FIELDS.map(x => [x.key, cleanInput(f.get(x.key), 40)] as const).filter(([, v]) => v)),
    body: cleanInput(f.get('body'), REVIEW_LIMITS.body, true),
  }
  if (!validateReview(input) || !reviewLimit(me.id)) return
  const d = flowDeps()
  const rv = await d.store.createReview({ ...input, authorId: me.id, lang: me.lang })
  const topic = `reviews:${rv.courseName}`
  await d.publish({ topic, kind: 'new', id: rv.id })
  translateLater(d, 'review', rv.id, { body: rv.body }, [topic])
  redirect(`/lectures/${encodeURIComponent(rv.courseName)}`)
}

// 강의평가 항목(에브리타임 역설계에서 이식, 6개 언어 라벨)과 집계·검증
import type { Lang } from './i18n'
import type { NewReview } from './store/types'

type Row = Record<Lang, string>
const r = (ko: string, en: string, vi: string, zh: string, uz: string, ja: string): Row => ({ ko, en, vi, zh, uz, ja })
const MANY = r('많음', 'A lot', 'Nhiều', '多', "Ko'p", '多い'), SOME = r('보통', 'Average', 'Bình thường', '一般', "O'rtacha", '普通'), NONE = r('없음', 'None', 'Không có', '没有', "Yo'q", 'なし')

/** 과목명·교수명·본문 길이 상한(폼 maxLength와 같다) */
export const REVIEW_LIMITS = { courseName: 40, professor: 20, body: 1000 } as const

export const REVIEW_FIELDS: { key: string; label: Row; options: { value: string; label: Row }[] }[] = [
  { key: 'hw', label: r('과제', 'Assignments', 'Bài tập', '作业', 'Topshiriqlar', '課題'), options: [{ value: '많음', label: MANY }, { value: '보통', label: SOME }, { value: '없음', label: NONE }] },
  { key: 'team', label: r('조모임', 'Group work', 'Làm nhóm', '小组作业', 'Guruh ishi', 'グループワーク'), options: [{ value: '많음', label: MANY }, { value: '보통', label: SOME }, { value: '없음', label: NONE }] },
  { key: 'grade', label: r('성적', 'Grading', 'Chấm điểm', '给分', 'Baholash', '成績評価'), options: [{ value: '너그러움', label: r('너그러움', 'Generous', 'Dễ', '宽松', 'Yumshoq', '寛大') }, { value: '보통', label: SOME }, { value: '깐깐함', label: r('깐깐함', 'Strict', 'Khắt khe', '严格', "Qattiq", '厳しめ') }] },
  { key: 'att', label: r('출결', 'Attendance', 'Điểm danh', '考勤', 'Davomat', '出席確認'), options: [
    { value: '전자출결', label: r('전자출결', 'App check-in', 'Điểm danh điện tử', '电子考勤', 'Elektron', 'アプリ出席') },
    { value: '직접호명', label: r('직접호명', 'Roll call', 'Gọi tên', '点名', "Ism bo'yicha", '点呼') },
    { value: '지정좌석', label: r('지정좌석', 'Assigned seats', 'Chỗ ngồi cố định', '固定座位', "Belgilangan o'rin", '指定席') },
    { value: '반영 안 함', label: r('반영 안 함', 'Not counted', 'Không tính', '不计入', 'Hisobga olinmaydi', '反映なし') },
    { value: '혼용', label: r('혼용', 'Mixed', 'Kết hợp', '混合', 'Aralash', '併用') },
  ] },
  { key: 'exam', label: r('시험', 'Exams', 'Thi', '考试', 'Imtihonlar', '試験'), options: [
    { value: '없음', label: NONE },
    { value: '한 번', label: r('한 번', 'Once', 'Một lần', '一次', 'Bir marta', '1回') },
    { value: '두 번', label: r('두 번', 'Twice', 'Hai lần', '两次', 'Ikki marta', '2回') },
    { value: '세 번', label: r('세 번', 'Three times', 'Ba lần', '三次', "Uch marta", '3回') },
    { value: '네 번 이상', label: r('네 번 이상', 'Four or more', 'Bốn lần trở lên', '四次以上', "To'rt va undan ko'p", '4回以上') },
  ] },
]

const fieldOf = (key: string) => REVIEW_FIELDS.find(f => f.key === key)

/** 평균 별점(소수 첫째 자리)과 항목별 선택 수. 정해진 항목·값만 센다(이상한 키로 객체 원형을 건드리지 않게) */
export function reviewSummary(reviews: { rating: number; fields: Record<string, string> }[]) {
  const fields: Record<string, Record<string, number>> = {}
  for (const rv of reviews)
    for (const f of REVIEW_FIELDS) {
      const v = Object.hasOwn(rv.fields, f.key) ? rv.fields[f.key] : undefined
      if (!v || !f.options.some(o => o.value === v)) continue
      const counts = (fields[f.key] ??= {})
      counts[v] = (counts[v] ?? 0) + 1
    }
  const count = reviews.length
  const avg = count ? Math.round((reviews.reduce((n, x) => n + x.rating, 0) / count) * 10) / 10 : 0
  return { count, avg, fields }
}

/** 과목명·본문 필수, 별점 1~5 정수, 길이 상한, 항목은 정해진 키·값만 */
export function validateReview(rv: Omit<NewReview, 'authorId' | 'lang'>): boolean {
  const courseName = rv.courseName.trim(), body = rv.body.trim()
  if (!courseName || courseName.length > REVIEW_LIMITS.courseName) return false
  if (!body || body.length > REVIEW_LIMITS.body || rv.professor.length > REVIEW_LIMITS.professor) return false
  if (!Number.isInteger(rv.rating) || rv.rating < 1 || rv.rating > 5) return false
  return Object.entries(rv.fields).every(([k, v]) => fieldOf(k)?.options.some(o => o.value === v) ?? false)
}

// 강의평가 집계와 입력 검증 테스트
import { describe, it, expect } from 'vitest'
import { reviewSummary, validateReview } from '@/lib/reviews'

const R = (rating: number, hw: string) => ({ rating, fields: { hw } })

describe('reviewSummary', () => {
  it('평균과 항목별 집계', () => {
    const s = reviewSummary([R(5, '많음'), R(4, '많음'), R(3, '보통')])
    expect(s.avg).toBe(4)
    expect(s.count).toBe(3)
    expect(s.fields.hw).toEqual({ 많음: 2, 보통: 1 })
  })
  it('빈 목록', () => {
    expect(reviewSummary([])).toMatchObject({ avg: 0, count: 0 })
  })
})

describe('validateReview', () => {
  const ok = { courseName: '네트워크프로그래밍', professor: '김', rating: 4, fields: { hw: '많음' }, body: '좋아요' }
  it('정상 입력 통과', () => expect(validateReview(ok)).toBe(true))
  it('평점 1~5 밖은 거부', () => {
    expect(validateReview({ ...ok, rating: 0 })).toBe(false)
    expect(validateReview({ ...ok, rating: 6 })).toBe(false)
    expect(validateReview({ ...ok, rating: 3.5 })).toBe(false)
  })
  it('없는 항목 값은 거부', () => expect(validateReview({ ...ok, fields: { hw: '엄청 많음' } })).toBe(false))
  it('과목명·본문 비면 거부', () => {
    expect(validateReview({ ...ok, courseName: ' ' })).toBe(false)
    expect(validateReview({ ...ok, body: '' })).toBe(false)
  })
})

describe('강의평가 검증·집계 보강', () => {
  const ok = { courseName: '네트워크프로그래밍', professor: '김', rating: 4, fields: { hw: '많음' }, body: '좋아요' }
  it('길이 상한을 넘으면 거부', () => {
    expect(validateReview({ ...ok, courseName: 'x'.repeat(41) })).toBe(false)
    expect(validateReview({ ...ok, professor: 'x'.repeat(21) })).toBe(false)
    expect(validateReview({ ...ok, body: 'x'.repeat(1001) })).toBe(false)
  })
  it('없는 항목 키·NaN 별점은 거부', () => {
    expect(validateReview({ ...ok, fields: { nope: '많음' } })).toBe(false)
    expect(validateReview({ ...ok, rating: NaN })).toBe(false)
  })
  it('집계는 정해진 항목·값만 세고 객체 원형을 건드리지 않는다', () => {
    const s = reviewSummary([{ rating: 5, fields: JSON.parse('{"__proto__":{"polluted":1},"hw":"많음","x":"y"}') }])
    expect(s.fields).toEqual({ hw: { 많음: 1 } })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

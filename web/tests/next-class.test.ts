// 홈 첫 화면의 "지금/다음 수업" 고르기(한국 시간 기준) 테스트
import { describe, it, expect } from 'vitest'
import { nextClass } from '@/lib/timetable/next'

const C = (name: string, day: 0 | 1 | 2 | 3 | 4, start: number, end: number) => ({ name, place: '', day, start, end })
const list = [C('오전', 1, 540, 660), C('오후', 1, 780, 900), C('수요일', 2, 600, 720)]
// 2026-10-20(화) KST = UTC+9
const kst = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 20, h - 9, m))

describe('nextClass', () => {
  it('수업 중이면 지금 수업', () => expect(nextClass(list, kst(10))).toMatchObject({ course: { name: '오전' }, status: 'now' }))
  it('쉬는 시간이면 오늘 다음 수업', () => expect(nextClass(list, kst(12))).toMatchObject({ course: { name: '오후' }, status: 'next' }))
  it('오늘 수업이 끝나면 다음 수업 날의 첫 수업', () => expect(nextClass(list, kst(16))).toMatchObject({ course: { name: '수요일' }, status: 'later', inDays: 1 }))
  it('주말이면 다음 주 첫 수업', () => expect(nextClass(list, new Date(Date.UTC(2026, 9, 24, 3)))).toMatchObject({ course: { name: '오전' }, status: 'later', inDays: 3 }))
  it('금요일 수업이 끝나면 다음 주 월요일로 넘어간다', () => {
    const fri = [C('월요일', 0, 540, 600), C('금요일', 4, 540, 600)]
    expect(nextClass(fri, new Date(Date.UTC(2026, 9, 23, 7)))).toMatchObject({ course: { name: '월요일' }, status: 'later', inDays: 3 })
  })
  it('시간표가 비어 있으면 null', () => expect(nextClass([], kst(10))).toBeNull())
})

describe('서버가 UTC일 때도 한국 시간 기준', () => {
  it('UTC 월요일 23:30 = 한국 화요일 08:30 → 화요일 첫 수업이 오늘 다음 수업', () => {
    expect(nextClass(list, new Date(Date.UTC(2026, 9, 19, 23, 30)))).toMatchObject({ course: { name: '오전' }, status: 'next', inDays: 0 })
  })
  it('kstClock: 요일·분', async () => {
    const { kstClock } = await import('@/lib/timetable/next')
    expect(kstClock(new Date(Date.UTC(2026, 9, 25, 15, 0)))).toEqual({ day: 0, min: 0 }) // 일 15:00 UTC = 월 00:00 KST
  })
})

describe('이번 학기(한국 시간)', () => {
  it('8~12월은 그해 2학기, 2~7월은 1학기, 1월은 지난해 2학기', async () => {
    const { semesterOf } = await import('@/lib/timetable/sem')
    expect(semesterOf(new Date(Date.UTC(2026, 10, 5)))).toEqual({ year: 2026, term: 2 })
    expect(semesterOf(new Date(Date.UTC(2027, 2, 2)))).toEqual({ year: 2027, term: 1 })
    expect(semesterOf(new Date(Date.UTC(2027, 0, 15)))).toEqual({ year: 2026, term: 2 })
    // UTC로는 1월 31일 밤이지만 한국은 2월 1일
    expect(semesterOf(new Date(Date.UTC(2027, 0, 31, 16)))).toEqual({ year: 2027, term: 1 })
  })
  it('학기 목록은 이번 학기부터 네 학기', async () => {
    const { semesters } = await import('@/lib/timetable/sem')
    expect(semesters(new Date(Date.UTC(2026, 10, 5)))).toEqual(['2026년 2학기', '2026년 1학기', '2025년 2학기', '2025년 1학기'])
  })
})

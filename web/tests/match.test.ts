// 공강 겹침 계산과 친구 추천 순위 테스트
import { describe, it, expect } from 'vitest'
import { freeMask, overlapRanges, rankMatches, formatRange, sameClassMatches } from '@/lib/timetable/match'
import { busyMask, normalizeParsed } from '@/lib/timetable/slots'
import { SAMPLE_TIMETABLE } from '@/lib/ai/fake'
import type { Profile } from '@/lib/types'

const A = normalizeParsed(SAMPLE_TIMETABLE).courses
const B = [{ name: 'x', place: '', day: 1 as const, start: 540, end: 780 }]
const P = (id: string): Profile => ({ id, handle: id, nickname: id, nationality: 'KR', lang: 'ko', passHash: '', createdAt: 0 })

describe('match', () => {
  it('목요일은 둘 다 비어서 09:00–18:00 한 덩어리', () => {
    const ranges = overlapRanges(freeMask(busyMask(A)), freeMask(busyMask(B)))
    expect(ranges.filter(r => r.day === 3)).toEqual([{ day: 3, start: 540, end: 1080 }])
  })
  it('공강은 낮 시간(09–18시)만: 저녁 수업이 있어도 공강 구간은 18시에서 끝난다', () => {
    const evening = [...B, { name: 'n', place: '', day: 3 as const, start: 1080, end: 1260 }]
    const ranges = overlapRanges(freeMask(busyMask(A)), freeMask(busyMask(evening)))
    expect(ranges.filter(r => r.day === 3)).toEqual([{ day: 3, start: 540, end: 1080 }])
    expect(Math.max(...ranges.map(r => r.end))).toBeLessThanOrEqual(1080)
  })
  it('겹치는 칸은 하나로 합친다', () => {
    const ranges = overlapRanges(freeMask(busyMask(A)), freeMask(busyMask(B)))
    for (const r of ranges) expect(ranges.filter(x => x.day === r.day && x.end === r.start)).toEqual([])
  })
  it('시간표 없는 사람·나·이미 친구는 빼고, 겹치는 시간 많은 순', () => {
    const me = P('me')
    const res = rankMatches(me, A, [
      { profile: me, courses: A },
      { profile: P('empty'), courses: [] },
      { profile: P('busy'), courses: [{ name: 'y', place: '', day: 3, start: 540, end: 1080 }] },
      { profile: P('free'), courses: B },
      { profile: P('friend'), courses: B },
    ], new Set(['friend']))
    expect(res.map(r => r.profile.id)).toEqual(['free', 'busy'])
    expect(res[0].minutes).toBeGreaterThan(res[1].minutes)
  })
  it('시간 범위 표기', () => {
    expect(formatRange({ day: 1, start: 780, end: 900 }, 'ko')).toBe('화 13:00–15:00')
    expect(formatRange({ day: 1, start: 780, end: 900 }, 'en')).toBe('Tue 13:00–15:00')
  })
})

describe('같은 수업 듣는 사람', () => {
  const c = (name: string, day: 0 | 1 | 2 | 3 | 4, start: number, code?: string) => ({ name, place: '', day, start, end: start + 90, code })
  it('같은 과목(코드, 없으면 이름·요일·시작)을 듣는 사람을 겹친 과목 수 순으로, 나·친구는 빼고', () => {
    const me = P('me')
    const mine = [c('자료구조', 0, 540, 'CS201'), c('자료구조', 2, 540, 'CS201'), c('영어회화', 1, 600), c('미적분', 3, 540)]
    const res = sameClassMatches(me, mine, [
      { profile: me, courses: mine },
      { profile: P('two'), courses: [c('자료구조', 0, 540, 'CS201'), c('영어회화', 1, 600)] },
      { profile: P('one'), courses: [c('자료구조', 2, 540, 'CS201')] },
      { profile: P('otherSection'), courses: [c('영어회화', 4, 600)] },
      { profile: P('friend'), courses: mine },
    ], new Set(['friend']))
    expect(res.map(r => [r.profile.id, r.shared])).toEqual([['two', ['자료구조', '영어회화']], ['one', ['자료구조']]])
  })
})

describe('cleanHandle', () => {
  it('%인코딩·대문자·@·공백을 정리하고 규칙에 맞지 않으면 null', async () => {
    const { cleanHandle } = await import('@/lib/timetable/match')
    expect(cleanHandle('Minjun')).toBe('minjun')
    expect(cleanHandle(' @linh ')).toBe('linh')
    expect(cleanHandle('%6Cinh')).toBe('linh')
    expect(cleanHandle('%E0%A4%A')).toBeNull()
    expect(cleanHandle('../admin')).toBeNull()
    expect(cleanHandle('ab')).toBeNull()
    expect(cleanHandle(['minjun'])).toBeNull()
  })
})

describe('직접 일정은 같은 수업으로 치지 않는다', () => {
  it('코드가 다른 직접 일정(my-…)은 이름·시간이 같아도 매칭되지 않는다', () => {
    const me = P('me')
    const job = (code: string) => ({ name: '아르바이트', place: '', day: 0 as const, start: 540, end: 600, code })
    expect(sameClassMatches(me, [job('my-a')], [{ profile: P('x'), courses: [job('my-b')] }], new Set())).toEqual([])
  })
})

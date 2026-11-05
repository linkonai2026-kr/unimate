// 최종 리뷰 지적 사항(C1·I1·I2·I4·I6·I7)을 재현하는 테스트
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('@/lib/ai/claude') })

describe('C1: 키가 있을 때 번역이 실패하면 가짜 번역을 저장하지 않는다', () => {
  it('Claude가 실패하면 translate는 예외를 낸다(원문 유지)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.doMock('@/lib/ai/claude', () => ({ claudeTranslate: vi.fn().mockRejectedValue(new Error('boom')), TRANSLATE_EFFORT: 'medium' }))
    const { translate } = await import('@/lib/ai')
    await expect(translate({ body: '안녕하세요 반가워요' })).rejects.toThrow()
  })
  it('데모 대본 문장은 키가 있어도 사전 번역', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.doMock('@/lib/ai/claude', () => ({ claudeTranslate: vi.fn().mockRejectedValue(new Error('boom')), TRANSLATE_EFFORT: 'medium' }))
    const { translate } = await import('@/lib/ai')
    expect((await translate({ title: '오늘 5공학관 식당 같이 갈 사람?' })).tr.vi?.title).toContain('căng tin')
  })
})

describe('I1: 학교 데이터 캐시는 시간이 지나면 다시 만든다', () => {
  it('TTL이 지나면 make를 다시 부른다', async () => {
    const { createMemo } = await import('@/lib/school/memo')
    let now = 0, calls = 0
    const memo = createMemo(1000, () => now)
    await memo('k', async () => ++calls)
    await memo('k', async () => ++calls)
    now = 1001
    await memo('k', async () => ++calls)
    expect(calls).toBe(2)
  })
})

describe('I2: 모르는 식사 구분 이름도 화면이 깨지지 않는다', () => {
  it('mealLabel은 모르는 값이면 원문을 돌려준다', async () => {
    const { mealLabel } = await import('@/lib/school/menu')
    expect(mealLabel('점심', 'en')).toBe('Lunch')
    expect(mealLabel('중식', 'en')).toBe('중식')
  })
})

describe('I4: 인식·저장되는 과목명·장소 길이를 자른다', () => {
  it('이름 40자, 장소 80자', async () => {
    const { normalizeParsed } = await import('@/lib/timetable/slots')
    const r = normalizeParsed([{ name: 'x'.repeat(500), place: 'y'.repeat(500), day: 0, start: '10:00', end: '11:00' }])
    expect(r.courses[0].name).toHaveLength(40)
    expect(r.courses[0].place).toHaveLength(80)
  })
})

describe('I6: 운영 환경에서 SESSION_SECRET이 없으면 서명하지 않는다', () => {
  it('production + 비밀값 없음 → 예외', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SESSION_SECRET', '')
    const { signSession } = await import('@/lib/auth/token')
    expect(() => signSession('u1')).toThrow()
  })
})

describe('I7: 끝 시간만 12시간제로 온 수업', () => {
  it('11:00–01:00 → 11:00–13:00', async () => {
    const { normalizeParsed } = await import('@/lib/timetable/slots')
    expect(normalizeParsed([{ name: 'A', place: '', day: 0, start: '11:00', end: '01:00' }]).courses[0]).toMatchObject({ start: 660, end: 780 })
  })
  it('12:00–01:00 → 12:00–13:00', async () => {
    const { normalizeParsed } = await import('@/lib/timetable/slots')
    expect(normalizeParsed([{ name: 'A', place: '', day: 0, start: '12:00', end: '01:00' }]).courses[0]).toMatchObject({ start: 720, end: 780 })
  })
})

describe('AI 호출: 실패하면 대역, 시간 제한은 요청 자체를 끊는 신호로', () => {
  it('요약이 실패하면 대역 3줄', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.doMock('@/lib/ai/claude', () => ({ claudeSummary: vi.fn().mockRejectedValue(new Error('boom')) }))
    const { summarizeNotice } = await import('@/lib/ai')
    expect((await summarizeNotice('제목', '첫 문장. 둘째 문장. 셋째 문장.', 'en')).bullets).toHaveLength(3)
  })
  it('목록 번역은 중단 신호를 넘기고, 실패하면 원문 목록', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const claudeList = vi.fn().mockRejectedValue(new Error('boom'))
    vi.doMock('@/lib/ai/claude', () => ({ claudeList }))
    const { translateList } = await import('@/lib/ai')
    const items = ['백반']
    expect(await translateList(items, 'en')).toEqual(items)
    expect(claudeList.mock.calls[0][2]).toBeInstanceOf(AbortSignal)
  })
  it('번역은 중단 신호를 넘긴다', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const claudeTranslate = vi.fn().mockResolvedValue({ detected: 'ko', tr: {} })
    vi.doMock('@/lib/ai/claude', () => ({ claudeTranslate }))
    const { translate } = await import('@/lib/ai')
    await translate({ body: '처음 보는 문장이에요' })
    expect(claudeTranslate.mock.calls[0][2]).toBeInstanceOf(AbortSignal)
  })
})

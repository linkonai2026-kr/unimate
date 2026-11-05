// 시간표 칸 계산(비트마스크)과 인식 결과 정규화 테스트
import { describe, it, expect } from 'vitest'
import { busyMask, normalizeParsed, toMin, fmtMin, SLOTS_PER_DAY } from '@/lib/timetable/slots'
import { SAMPLE_TIMETABLE } from '@/lib/ai/fake'

const sample = normalizeParsed(SAMPLE_TIMETABLE).courses
const bit = (day: number, slot: number) => 1n << BigInt(day * SLOTS_PER_DAY + slot)

describe('slots', () => {
  it('시각 변환', () => {
    expect(toMin('13:30')).toBe(810)
    expect(fmtMin(810)).toBe('13:30')
  })
  it('샘플 시간표: 화 17:30 칸은 수업, 목요일은 전부 빔', () => {
    const m = busyMask(sample)
    expect(m & bit(1, 17)).not.toBe(0n)
    for (let s = 0; s < SLOTS_PER_DAY; s++) expect(m & bit(3, s)).toBe(0n)
  })
  it('샘플 정답 8과목은 경고 없이 그대로', () => {
    const r = normalizeParsed(SAMPLE_TIMETABLE)
    expect(r.courses).toHaveLength(8)
    expect(r.warnings).toEqual([])
  })
})

describe('gridEnd(격자 끝 시각)', () => {
  it('평소엔 18시, 늦게 끝나는 수업이 있으면 그 시각을 올림한 정시(최대 21시)', async () => {
    const { gridEnd } = await import('@/lib/timetable/slots')
    expect(gridEnd(sample)).toBe(1080)
    expect(gridEnd([])).toBe(1080)
    expect(gridEnd([{ end: 1215 }])).toBe(1260)
    expect(gridEnd([{ end: 1140 }])).toBe(1140)
  })
})

describe('normalizeParsed', () => {
  it('오전 1~8시 시작은 오후로 보정하고 경고', () => {
    const r = normalizeParsed([{ name: 'X', place: '', day: 0, start: '02:00', end: '04:00' }])
    expect(r.courses[0]).toMatchObject({ start: 840, end: 960 })
    expect(r.warnings).toHaveLength(1)
  })
  it('09시 이전은 09시로 자르고 경고', () => {
    const r = normalizeParsed([{ name: 'X', place: '', day: 0, start: '08:00', end: '10:00' }])
    expect(r.courses[0].start).toBe(540)
    expect(r.warnings).toHaveLength(1)
  })
  it('끝이 시작보다 빠르거나 이름·요일이 이상하면 버린다', () => {
    const r = normalizeParsed([
      { name: 'A', place: '', day: 0, start: '12:00', end: '11:00' },
      { name: '', place: '', day: 0, start: '10:00', end: '11:00' },
      { name: 'B', place: '', day: 6, start: '10:00', end: '11:00' },
    ])
    expect(r.courses).toEqual([])
  })
  it('빈 결과는 경고 하나', () => {
    const r = normalizeParsed([])
    expect(r.courses).toEqual([])
    expect(r.warnings).toHaveLength(1)
  })
  it('18시 이후 저녁 수업(18:00–21:00)은 자르지 않고 경고도 없다', () => {
    const r = normalizeParsed([{ name: '야간', place: '', day: 2, start: '18:00', end: '21:00' }])
    expect(r.courses[0]).toMatchObject({ start: 1080, end: 1260 })
    expect(r.warnings).toEqual([])
  })
  it('21시를 넘으면 21시로 자르고 경고', () => {
    const r = normalizeParsed([{ name: '야간', place: '', day: 2, start: '19:00', end: '22:00' }])
    expect(r.courses[0].end).toBe(1260)
    expect(r.warnings).toEqual([{ code: 'clamp', name: '야간' }])
  })
  it('같은 요일 겹침은 경고', () => {
    const r = normalizeParsed([
      { name: 'A', place: '', day: 0, start: '10:00', end: '12:00' },
      { name: 'B', place: '', day: 0, start: '11:00', end: '13:00' },
    ])
    expect(r.courses).toHaveLength(2)
    expect(r.warnings).toHaveLength(1)
  })
})

describe('toMin 범위 검사', () => {
  it('24시 이상·60분 이상·형식 틀림은 NaN, 초가 붙은 값은 받는다', () => {
    expect(toMin('25:00')).toBeNaN()
    expect(toMin('10:60')).toBeNaN()
    expect(toMin('1030')).toBeNaN()
    expect(toMin(undefined)).toBeNaN()
    expect(toMin('13:30:00')).toBe(810)
    expect(toMin(' 9:05 ')).toBe(545)
  })
})

describe('normalizeParsed 예외 입력', () => {
  it('버린 줄은 invalid 경고로 알린다', () => {
    const r = normalizeParsed([
      { name: 'A', place: '', day: 0, start: '12:00', end: '11:00' },
      { name: 'B', place: '', day: 7, start: '10:00', end: '11:00' },
    ])
    expect(r.warnings.filter(w => w.code === 'invalid').map(w => w.name)).toEqual(['A', 'B'])
  })
  it('문자열이 아닌 값이 와도 죽지 않는다', () => {
    const bad = [{ name: 3, place: null, day: 0, start: '10:00', end: '11:00' }, null] as unknown as Parameters<typeof normalizeParsed>[0]
    expect(normalizeParsed(bad).courses).toEqual([])
  })
  it('장소가 문자열이 아니면 빈 칸', () => {
    const r = normalizeParsed([{ name: 'A', place: undefined, day: 1, start: '10:00', end: '11:00' } as unknown as Parameters<typeof normalizeParsed>[0][number]])
    expect(r.courses[0].place).toBe('')
  })
})

describe('gridEnd·busyMask 예외 입력', () => {
  it('gridEnd는 NaN 끝 시각을 무시한다', async () => {
    const { gridEnd } = await import('@/lib/timetable/slots')
    expect(gridEnd([{ end: NaN }])).toBe(1080)
  })
  it('busyMask는 요일이 이상한 강의를 건너뛴다', () => {
    expect(busyMask([{ day: 5 as 0, start: 540, end: 600 }, { day: -1 as 0, start: 540, end: 600 }])).toBe(0n)
  })
})

describe('normalizeParsed 글자 정리', () => {
  it('제어 문자(NUL 등)를 빼고, 이모지 반쪽 없이 자른다', () => {
    const r = normalizeParsed([{ name: `A\u0000B${'x'.repeat(37)}😀`, place: 'P\u0007', day: 0, start: '10:00', end: '11:00' }])
    expect(r.courses[0].name).toBe(`A B${'x'.repeat(37)}`)
    expect(r.courses[0].place).toBe('P')
  })
})

// 공지 마감 글자 해석(D-day·캘린더 시각)
import { describe, expect, it } from 'vitest'
import { dDayOf, dueMs, parseDue } from '@/lib/deadlines/when'
import { dDay } from '@/lib/school/notices'

// 2026-11-06 12:00 한국 시각
const now = new Date('2026-11-06T03:00:00Z')

describe('parseDue', () => {
  it('AI 요약 형식 "11/17 18:00"을 날짜와 시각으로 읽는다', () => {
    expect(parseDue('11/17 18:00', now)).toEqual({ y: 2026, m: 11, d: 17, h: 18, min: 0 })
  })
  it('연도가 있는 날짜, 한국어 날짜, 오후 시각', () => {
    expect(parseDue('2026.11.20', now)).toEqual({ y: 2026, m: 11, d: 20, h: null, min: null })
    expect(parseDue('11월 17일 오후 6시', now)).toEqual({ y: 2026, m: 11, d: 17, h: 18, min: 0 })
    expect(parseDue('11월 17일 17시 30분', now)).toEqual({ y: 2026, m: 11, d: 17, h: 17, min: 30 })
  })
  it('기간이면 끝 날짜를 쓴다', () => {
    expect(parseDue('11/10~11/17', now)).toMatchObject({ m: 11, d: 17 })
    expect(parseDue('2026.11.10 ~ 2026.11.21 18:00', now)).toEqual({ y: 2026, m: 11, d: 21, h: 18, min: 0 })
  })
  it('연도 없이 한참 지난 날짜는 다음 해로 본다', () => {
    expect(parseDue('1/5', now)).toMatchObject({ y: 2027, m: 1, d: 5 })
    // 조금 지난 날짜는 올해(지난 마감)
    expect(parseDue('10/31', now)).toMatchObject({ y: 2026, m: 10, d: 31 })
  })
  it('없는 날짜·날짜가 아닌 글자는 null', () => {
    expect(parseDue('2/30', now)).toBeNull()
    expect(parseDue('곧', now)).toBeNull()
    expect(parseDue('', now)).toBeNull()
    expect(parseDue('3.5학점', now)).toBeNull()
  })
})

describe('dDay', () => {
  it('AI 요약 형식에도 D-day가 붙는다(예전에는 null이었다)', () => {
    expect(dDay('11/17 18:00', now)).toBe('D-11')
    expect(dDayOf('11/6', now)).toBe('D-day')
    expect(dDay('10/31', now)).toBeNull()
  })
})

describe('dueMs', () => {
  it('시각이 없으면 그날 23:59(한국)', () => {
    expect(new Date(dueMs({ y: 2026, m: 11, d: 17, h: null, min: null })).toISOString()).toBe('2026-11-17T14:59:00.000Z')
    expect(new Date(dueMs({ y: 2026, m: 11, d: 17, h: 18, min: 0 })).toISOString()).toBe('2026-11-17T09:00:00.000Z')
  })
})

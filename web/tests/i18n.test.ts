// 다국어 사전의 언어 목록과 누락 문구를 검사하는 테스트
import { describe, it, expect } from 'vitest'
import { LANGS, UI, t } from '@/lib/i18n'
import { RULES, RULES_TR } from '@/lib/moderation'

describe('i18n', () => {
  it('지원 언어는 ko, en, vi, zh, uz 다섯 개', () => {
    expect(LANGS.map(l => l.code)).toEqual(['ko', 'en', 'vi', 'zh', 'uz', 'ja'])
  })

  it('모든 문구가 여섯 언어 모두 채워져 있다', () => {
    for (const [key, byLang] of Object.entries(UI)) {
      for (const { code } of LANGS) {
        expect(byLang[code], `${key}.${code}`).toBeTruthy()
      }
    }
  })

  it('t()는 언어별 문구를 돌려준다', () => {
    expect(t('vi', 'tab.board')).not.toBe(t('ko', 'tab.board'))
  })

  it('모든 언어의 {자리} 이름이 한국어와 같다(번역에서 자리가 빠지거나 바뀌지 않게)', () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    for (const [key, byLang] of Object.entries(UI)) {
      for (const { code } of LANGS) expect(holes(byLang[code]), `${key}.${code}`).toEqual(holes(byLang.ko))
    }
  })

  it('t()는 자리를 모두 바꾸고, $ 패턴도 글자 그대로, 숫자도 받는다', () => {
    expect(t('en', 'helloName', { name: '$& $1 $$' })).toBe('Hi, $& $1 $$')
    expect(t('ko', 'sameClassN', { n: 3 })).toBe('같은 수업 3개')
    expect(t('en', 'floorRoom', { floor: 3, room: '304' })).toBe('Go to room 304 on floor 3')
  })

  it('t()는 빠진 자리는 그대로 두고, 이상한 언어·키에도 깨지지 않는다', () => {
    expect(t('en', 'helloName')).toBe('Hi, {name}')
    expect(t('en', 'helloName', {})).toBe('Hi, {name}')
    expect(t('xx' as never, 'login')).toBe('로그인')
    expect(t('en', 'no.such.key' as never)).toBe('no.such.key')
    expect(t('en', 'constructor' as never)).toBe('constructor')
  })

  it('dayName은 월요일부터, 범위 밖 번호도 한 주 안으로', async () => {
    const { dayName } = await import('@/lib/i18n')
    expect(dayName(0, 'en')).toBe('Mon')
    expect(dayName(4, 'en')).toBe('Fri')
    expect(dayName(7, 'en')).toBe('Mon')
    expect(dayName(-1, 'en')).toBe('Sun')
  })
})

describe('nationName', () => {
  it('국가 코드를 사용자 언어 이름으로(이모지 없이)', async () => {
    const { nationName } = await import('@/lib/nations')
    expect(nationName('VN', 'ko')).toBe('베트남')
    expect(nationName('KR', 'en')).toBe('South Korea')
    expect(nationName('XX', 'ko')).toBe('기타')
  })
})

describe('저장된 한국어 기본 이름의 화면 표시', () => {
  it('학기·학년 학기·자동 시간표 이름은 화면 언어로, 사용자가 지은 이름은 그대로', async () => {
    const { semLabel, gradeSemLabel, tableLabel } = await import('@/lib/timetable/sem')
    expect(semLabel('2026년 2학기', 'en')).toBe('Semester 2, 2026')
    expect(semLabel('2026년 2학기', 'ko')).toBe('2026년 2학기')
    expect(gradeSemLabel('1학년 2학기', 'uz')).toBe('1-kurs 2-semestr')
    expect(tableLabel('시간표 3', 'vi')).toBe('Thời khóa biểu 3')
    expect(tableLabel('내 시간표', 'en')).toBe('내 시간표')
  })
})

describe('이용규칙 번역', () => {
  it('한국어 외 모든 언어에 규칙과 같은 수의 제목·설명이 미리 들어 있다(규칙 화면은 AI를 부르지 않는다)', () => {
    for (const l of LANGS.map(x => x.code).filter(c => c !== 'ko') as Exclude<(typeof LANGS)[number]['code'], 'ko'>[]) {
      expect(RULES_TR[l]).toHaveLength(RULES.length)
      for (const r of RULES_TR[l]) expect(r.title.trim() && r.desc.trim()).toBeTruthy()
    }
  })
})

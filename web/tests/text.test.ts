// 열람자 언어로 보여 줄 문장을 고르는 pickText, 상대 시간 timeAgo, 대역 래퍼 withTimeout 테스트
import { describe, it, expect, vi } from 'vitest'
import { pickText } from '@/lib/text'
import { isNew, timeAgo } from '@/lib/time'
import { withTimeout } from '@/lib/timeout'

const item = { lang: 'ko' as const, tr: { vi: { body: 'Xin chào' } } }

describe('pickText', () => {
  it('열람자 언어 번역이 있으면 번역', () => {
    expect(pickText(item, 'body', '안녕', 'vi')).toEqual({ text: 'Xin chào', translated: true })
  })
  it('열람자가 원문 언어면 원문', () => {
    expect(pickText({ lang: 'ko', tr: { ko: { body: '다듬은 문장' } } }, 'body', '안녕', 'ko')).toEqual({ text: '안녕', translated: false })
  })
  it('번역이 없으면 원문', () => {
    expect(pickText(item, 'body', '안녕', 'zh')).toEqual({ text: '안녕', translated: false })
  })
  it('공백뿐인 번역이나 tr이 없는 행은 원문', () => {
    expect(pickText({ lang: 'ko', tr: { en: { body: '  ' } } }, 'body', '안녕', 'en')).toEqual({ text: '안녕', translated: false })
    expect(pickText({ lang: 'ko', tr: null }, 'body', '안녕', 'en')).toEqual({ text: '안녕', translated: false })
  })
})

describe('timeAgo', () => {
  const now = Date.UTC(2026, 10, 5, 12)
  it('분·시간·일 단위로', () => {
    expect(timeAgo(now - 3 * 60_000, 'en', now)).toBe('3 minutes ago')
    expect(timeAgo(now - 2 * 3600_000, 'en', now)).toBe('2 hours ago')
    expect(timeAgo(now - 3 * 86400_000, 'en', now)).toBe('3 days ago')
  })
  it('반올림해 단위를 넘으면 다음 단위(60분 전이 아니라 1시간 전)', () => {
    expect(timeAgo(now - 59.7 * 60_000, 'en', now)).toBe('1 hour ago')
  })
  it('조금 미래인 시각·이상한 값', () => {
    expect(timeAgo(now + 5 * 60_000, 'en', now)).toBe('now')
    expect(timeAgo(NaN, 'en', now)).toBe('')
  })
  it('isNew는 한 시간 안', () => {
    expect(isNew(now - 59 * 60_000, now)).toBe(true)
    expect(isNew(now - 61 * 60_000, now)).toBe(false)
  })
})

describe('withTimeout', () => {
  it('늦으면 대역을 한 번만 부르고, 대역이 던지면 그대로 던진다', async () => {
    const fallback = vi.fn(() => { throw new Error('fallback failed') })
    await expect(withTimeout(new Promise<number>(() => {}), 5, fallback)).rejects.toThrow('fallback failed')
    expect(fallback).toHaveBeenCalledTimes(1)
  })
  it('원래 값이 문자열 "late"여도 대역으로 바꾸지 않는다', async () => {
    expect(await withTimeout(Promise.resolve('late'), 100, () => 'fallback')).toBe('late')
  })
})

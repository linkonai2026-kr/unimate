// 가입할 때 국적에 맞춰 미리 골라 주는 화면 언어
import { describe, expect, it } from 'vitest'
import { isLang } from '@/lib/i18n'
import { langForNation, NATION_LANG, NATIONS } from '@/lib/nations'

describe('langForNation', () => {
  it('화면 언어가 있는 나라는 그 언어', () => {
    expect(langForNation('KR')).toBe('ko')
    expect(langForNation('VN')).toBe('vi')
    expect(langForNation('CN')).toBe('zh')
    expect(langForNation('UZ')).toBe('uz')
  })
  it('화면 언어가 없는 나라·기타·모르는 값은 영어', () => {
    expect(langForNation('MN')).toBe('en')
    expect(langForNation('JP')).toBe('en')
    expect(langForNation('XX')).toBe('en')
    expect(langForNation('ZZ')).toBe('en')
    expect(langForNation('__proto__')).toBe('en')
  })
  it('모든 국적에 지원하는 화면 언어가 정해져 있다', () => {
    for (const n of NATIONS) expect(isLang(NATION_LANG[n])).toBe(true)
  })
})

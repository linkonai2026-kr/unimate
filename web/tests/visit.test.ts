// 방문객 모드: 로그인 없는 길찾기 요청 제한과 언어를 유지하는 주소 만들기 테스트
import { describe, it, expect } from 'vitest'
import { createLimiter } from '@/lib/rate-limit'
import { visitHref, POPULAR } from '@/lib/visit'
import { BUILDINGS } from '@/lib/map/buildings'

describe('createLimiter', () => {
  it('창 안에서 limit번까지만 허용하고, 창이 지나면 다시 허용', () => {
    const allow = createLimiter({ limit: 3, windowMs: 1000 })
    expect([allow('a', 0), allow('a', 10), allow('a', 20), allow('a', 30)]).toEqual([true, true, true, false])
    expect(allow('b', 30)).toBe(true)
    expect(allow('a', 1001)).toBe(true)
  })
})

describe('visitHref', () => {
  it('방문객 화면 주소에 언어를 붙이고, 다른 쿼리와 함께 쓴다', () => {
    expect(visitHref('/visit', 'vi')).toBe('/visit?lang=vi')
    expect(visitHref('/visit/map', 'en', { b: 'library' })).toBe('/visit/map?b=library&lang=en')
  })
  it('빈 값은 빼고, query의 lang이 화면 언어를 덮어쓰지 못한다', () => {
    expect(visitHref('/visit/map', 'en', { b: '', go: undefined, lang: 'ko' })).toBe('/visit/map?lang=en')
    expect(visitHref('/visit/map', 'vi', { b: 'library', go: '1' })).toBe('/visit/map?b=library&go=1&lang=vi')
  })
})

describe('POPULAR', () => {
  it('자주 찾는 곳은 모두 실제 건물 id', () => {
    for (const id of POPULAR) expect(BUILDINGS.some(b => b.id === id)).toBe(true)
  })
})

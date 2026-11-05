import { describe, expect, it } from 'vitest'
import { createGpsFilter, onRoute } from '@/lib/map/gps'
import { bearing, headingFrom, norm, smooth, turnBy } from '@/lib/map/heading'
import { straightRoute } from '@/lib/map/route'

/** 기준점에서 북쪽으로 m미터 */
const north = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_320, lng: p.lng })

describe('휴대폰 방향 계산', () => {
  it('아이폰은 webkitCompassHeading을 그대로, 화면을 눕히면 그만큼 더한다', () => {
    expect(headingFrom({ alpha: 10, webkitCompassHeading: 45 })).toBe(45)
    expect(headingFrom({ alpha: 10, webkitCompassHeading: 300 }, 90)).toBe(30)
  })
  it('안드로이드 절대 방향은 alpha가 반시계라 360에서 뺀다', () => {
    expect(headingFrom({ alpha: 90, absolute: true })).toBe(270) // 서쪽
    expect(headingFrom({ alpha: 0, absolute: true })).toBe(0)
  })
  it('북쪽을 모르는 상대 값이나 빈 값은 null', () => {
    expect(headingFrom({ alpha: 90, absolute: false })).toBeNull()
    expect(headingFrom({ alpha: null, absolute: true })).toBeNull()
  })
  it('각도 차이와 부드럽게 따라가기는 0/360 경계를 짧은 쪽으로 넘는다', () => {
    expect(turnBy(350, 10)).toBe(20)
    expect(turnBy(10, 350)).toBe(-20)
    expect(norm(-30)).toBe(330)
    expect(smooth(350, 10, 0.5)).toBe(0)
    expect(smooth(null, 123)).toBe(123)
  })
  it('방위각: 북쪽 0, 동쪽 90', () => {
    const a = { lat: 37.45, lng: 129.16 }
    expect(bearing(a, north(a, 100))).toBeCloseTo(0, 0)
    expect(bearing(a, { lat: a.lat, lng: a.lng + 0.001 })).toBeCloseTo(90, 0)
  })
})

describe('GPS 다듬기', () => {
  const base = { lat: 37.4524, lng: 129.162 }
  const east = (m: number) => ({ lat: base.lat, lng: base.lng + m / (111_320 * Math.cos((base.lat * Math.PI) / 180)) })
  const meters = (a: { lat: number; lng: number }) => (a.lng - base.lng) * 111_320 * Math.cos((base.lat * Math.PI) / 180)

  it('첫 값은 그대로, 같은 자리에서 흔들리는 값은 가운데로 모인다', () => {
    const f = createGpsFilter()
    expect(f.push({ pos: base, acc: 10, at: 0 }).pos).toEqual(base)
    let last = base
    for (let i = 1; i <= 10; i++) last = f.push({ pos: east(i % 2 ? 12 : -12), acc: 10, at: i * 1000 }).pos
    expect(Math.abs(meters(last))).toBeLessThan(8) // 원래 값은 ±12m로 튄다
  })
  it('정확도가 나쁜 튄 값(실내)은 버리고, 좋은 값은 따라간다', () => {
    const f = createGpsFilter()
    f.push({ pos: base, acc: 5, at: 0 })
    expect(meters(f.push({ pos: east(80), acc: 120, at: 1000 }).pos)).toBeCloseTo(0, 0)
    // 걸어서 10초 뒤 정확한 값은 대부분 받아들인다
    expect(meters(f.push({ pos: east(15), acc: 5, at: 11_000 }).pos)).toBeGreaterThan(12)
  })
  it('안내 중에는 경로에서 15m 안이면 경로 위로 붙인다', () => {
    const route = straightRoute(base, east(100))
    const off = { lat: base.lat + 8 / 111_320, lng: east(50).lng }
    expect(onRoute(route, off).lat).toBeCloseTo(base.lat, 6)
    const far = { lat: base.lat + 30 / 111_320, lng: east(50).lng }
    expect(onRoute(route, far)).toEqual(far)
    expect(onRoute(null, far)).toEqual(far)
  })
})

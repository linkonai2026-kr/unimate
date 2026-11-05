import { describe, expect, it } from 'vitest'
import { buildingById } from '@/lib/map/buildings'
import { headingOnPlan, indoorPlan, LEAVE_M, NEAR_M, nearbyPlan, startFloor, type IndoorPlan } from '@/lib/map/indoor'

/** 기준점에서 북쪽으로 m미터 */
const north = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_320, lng: p.lng })

describe('실내 안내도 전환', () => {
  const b = buildingById('greenenergy')!
  const plan: IndoorPlan = { buildingId: 'greenenergy', halfSize: 20, source: 't', floors: [{ floor: 2, image: '/x/2.png', north: 90 }, { floor: 1, image: '/x/1.png', north: 90 }] }
  const plans = [plan]

  it(`건물 벽에서 ${NEAR_M}m 안이면 띄우고, 멀면 안 띄운다`, () => {
    expect(nearbyPlan(north(b, 20 + NEAR_M - 2), { plans })?.buildingId).toBe('greenenergy')
    expect(nearbyPlan(north(b, 20 + NEAR_M + 5), { plans })).toBeNull()
    expect(nearbyPlan(null, { plans })).toBeNull()
  })
  it(`이미 띄운 건물은 ${LEAVE_M}m까지 유지한다(GPS가 흔들려도 깜빡이지 않게)`, () => {
    const p = north(b, 20 + NEAR_M + 5)
    expect(nearbyPlan(p, { plans, current: 'greenenergy' })?.buildingId).toBe('greenenergy')
    expect(nearbyPlan(north(b, 20 + LEAVE_M + 5), { plans, current: 'greenenergy' })).toBeNull()
  })
  it('출입구 좌표가 있으면 출입구에서 잰다', () => {
    const door = north(b, 60)
    const withDoor: IndoorPlan = { ...plan, entrances: [{ ...door, floor: 1, at: { x: 0.5, y: 1 } }] }
    expect(nearbyPlan(north(door, 5), { plans: [withDoor] })).not.toBeNull()
    expect(nearbyPlan(b, { plans: [withDoor] })).toBeNull()
  })
  it('처음 보여 줄 층: 가는 층 → 1층 → 가장 낮은 층', () => {
    expect(startFloor(plan, 2)).toBe(2)
    expect(startFloor(plan, 5)).toBe(1)
    expect(startFloor({ ...plan, floors: [{ floor: 3, image: '', north: 0 }, { floor: 2, image: '', north: 0 }] })).toBe(2)
  })
  it('안내도 위쪽이 동쪽이면, 동쪽을 볼 때 안내도에서는 위쪽(0)', () => {
    expect(headingOnPlan(90, plan.floors[0])).toBe(0)
    expect(headingOnPlan(0, plan.floors[0])).toBe(270)
  })
  it('등록된 안내도의 이미지 경로는 public/indoor 아래', () => {
    expect(indoorPlan('greenenergy')?.floors[0].image).toMatch(/^\/indoor\/greenenergy\//)
  })
})

import { describe, expect, it } from 'vitest'
import { buildingById } from '@/lib/map/buildings'
import { floorOfRoom, headingOnPlan, indoorFloors, indoorPlan, indoorRoute, LEAVE_M, NEAR_M, NEAR_MAX_M, nearIndoor, nearLimit, nearbyPlan, planFor, SKETCH, sketchRoom, startFloor, type IndoorPlan } from '@/lib/map/indoor'

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

describe('건물 접근(GPS 오차 범위)', () => {
  const b = buildingById('greenenergy')!
  const plans: IndoorPlan[] = [{ buildingId: 'greenenergy', halfSize: 20, source: 't', floors: [] }]

  it('오차가 크면 그만큼 멀리서도 다가왔다고 본다(한도까지)', () => {
    const p = north(b, 20 + 25)
    expect(nearIndoor(p, { ids: ['greenenergy'], plans, acc: 5 })).toBeNull()
    expect(nearIndoor(p, { ids: ['greenenergy'], plans, acc: 30 })).toBe('greenenergy')
    expect(nearLimit(500)).toBe(NEAR_MAX_M)
    expect(nearLimit(null)).toBe(NEAR_M)
  })
  it('안내도가 없는 건물도 가는 건물이면 살핀다', () => {
    const lib = buildingById('library')
    if (!lib) return
    expect(nearIndoor(lib, { ids: ['library'], plans: [] })).toBe('library')
    expect(planFor('library', [])?.floors).toEqual([])
    expect(planFor('없는건물', [])).toBeUndefined()
  })
})

describe('층별 실내 길', () => {
  const bare: IndoorPlan = { buildingId: 'greenenergy', floors: [], source: '' }

  it('호수에서 층을 읽는다', () => {
    expect(floorOfRoom('311')).toBe(3)
    expect(floorOfRoom('1205')).toBe(12)
    expect(floorOfRoom('B101')).toBe(-1)
    expect(floorOfRoom('강당')).toBeNull()
  })
  it('311호: 1층 입구 → 엘리베이터, 3층 엘리베이터 → 311호', () => {
    const r = indoorRoute(bare, { roomNo: '311', floor: 3 })
    expect(r.legs.map(l => [l.floor, l.from, l.to])).toEqual([[1, 'entrance', 'elevator'], [3, 'elevator', 'room']])
    expect(r.legs[0].path[0]).toEqual(SKETCH.entrance)
    expect(r.legs[0].path.at(-1)).toEqual(SKETCH.elevator)
    expect(r.legs[1].path[0]).toEqual(SKETCH.elevator)
    expect(r.legs[1].path.at(-1)).toEqual(sketchRoom('311'))
    expect(r.legs.every(l => l.sketch)).toBe(true)
    expect(indoorFloors(bare, r.floor)).toEqual([1, 3])
  })
  it('1층 강의실은 입구에서 바로, 호수를 모르면 엘리베이터까지만', () => {
    expect(indoorRoute(bare, { roomNo: '105', floor: 1 }).legs.map(l => [l.floor, l.from, l.to])).toEqual([[1, 'entrance', 'room']])
    expect(indoorRoute(bare, null).legs.map(l => [l.floor, l.from, l.to])).toEqual([[1, 'entrance', 'elevator']])
  })
  it('등록된 위치와 복도가 있으면 복도를 따라 가장 짧은 길로 간다', () => {
    const plan: IndoorPlan = {
      buildingId: 'greenenergy', source: 't',
      floors: [
        { floor: 1, image: '/x/1.png', north: 0, entrance: { x: 0.1, y: 0.9 }, elevator: { x: 0.9, y: 0.1 },
          nodes: { a: { x: 0.1, y: 0.5 }, b: { x: 0.9, y: 0.5 }, c: { x: 0.5, y: 0.9 } }, edges: [['a', 'b'], ['c', 'b']] },
        { floor: 3, image: '/x/3.png', north: 0, elevator: { x: 0.5, y: 0.5 }, rooms: { '311': { x: 0.8, y: 0.2 } } },
      ],
    }
    const r = indoorRoute(plan, { roomNo: '311', floor: 3 })
    expect(r.legs[0].sketch).toBe(false)
    // 입구(0.1,0.9)에서 가장 가까운 복도 지점은 a, 엘리베이터에서 가장 가까운 지점은 b
    expect(r.legs[0].path).toEqual([{ x: 0.1, y: 0.9 }, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.9, y: 0.1 }])
    // 3층은 복도가 없어 꺾인 직선, 등록된 311호 위치로
    expect(r.legs[1].path.at(-1)).toEqual({ x: 0.8, y: 0.2 })
    expect(r.legs[1].sketch).toBe(false)
  })
  it('약도에서 강의실은 홀수 왼쪽·짝수 오른쪽', () => {
    expect(sketchRoom('311').x).toBeLessThan(0.5)
    expect(sketchRoom('312').x).toBeGreaterThan(0.5)
  })
})

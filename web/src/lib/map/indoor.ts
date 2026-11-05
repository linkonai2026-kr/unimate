// 건물 실내 안내: 층별 안내도(이미지)와 이미지 위 위치(가로·세로 0~1 비율), 건물에 다가왔는지 판단, 층별 길(입구 → 엘리베이터 → 강의실).
// 이미지는 web/public/indoor/<건물 id>/<층>.<확장자>에 두고 여기 등록한다. 안내도가 없는 건물·층은 간단한 약도로 같은 순서를 보여 준다.
// north: 이미지 위쪽이 실제로 가리키는 방위(0 = 북쪽, 90 = 동쪽). 휴대폰 방향을 안내도 위에 맞출 때 쓴다
import { buildingById, type LatLng } from './buildings'
import { distance } from './route'

export interface IndoorPoint { x: number; y: number }
export interface IndoorEntrance extends LatLng { name?: string; floor: number; at: IndoorPoint }
export interface IndoorFloor {
  floor: number
  /** 안내도 이미지. 없으면 약도로 그린다 */
  image?: string
  north: number
  /** 호수 → 안내도 위 위치. 없는 호수는 약도 위치로 보여 준다 */
  rooms?: Record<string, IndoorPoint>
  /** 계단 위치(엘리베이터 위치를 모를 때 대신 쓴다) */
  stairs?: IndoorPoint[]
  /** 엘리베이터 위치 */
  elevator?: IndoorPoint
  /** 이 층 출입구 위치(보통 1층) */
  entrance?: IndoorPoint
  /** 복도 지점과 이어진 길. 있으면 이 길을 따라 가장 짧은 경로를 그리고, 없으면 꺾인 직선으로 그린다 */
  nodes?: Record<string, IndoorPoint>
  edges?: [string, string][]
}
export interface IndoorPlan {
  buildingId: string
  floors: IndoorFloor[]
  /** 출입구 좌표. 있으면 출입구 기준으로 가까움을 잰다 */
  entrances?: IndoorEntrance[]
  /** 출입구 좌표가 없을 때: 건물 중심에서 벽까지 대략 거리(m) */
  halfSize?: number
  /** 안내도 출처 표시. 비어 있으면 등록된 안내도가 없는 건물(약도만) */
  source: string
}

/** 건물(출입구)에서 이 거리 안이면 실내 지도 연결을 묻는다. GPS 오차가 더 크면 오차만큼 넓힌다 */
export const NEAR_M = 10
/** 오차로 넓히는 한도(오차가 아주 크면 멀리서도 뜨지 않게) */
export const NEAR_MAX_M = 40
/** 띄운 뒤 이만큼 더 멀어져야 사라진다(GPS가 흔들려서 화면이 왔다 갔다 하지 않게) */
export const LEAVE_M = 25
const DEFAULT_HALF = 20

export const INDOOR: IndoorPlan[] = [
  {
    buildingId: 'greenenergy',
    // 입구 안내도(현장 촬영)를 다시 그릴 자리. 이미지와 위쪽 방위는 현장에서 확인한 뒤 넣는다
    floors: [{ floor: 1, image: '/indoor/greenenergy/1.png', north: 0 }],
    halfSize: 22,
    source: '그린에너지연구관 1층 건물 안내도',
  },
]

export const indoorPlan = (buildingId: string | null | undefined, plans: IndoorPlan[] = INDOOR) => plans.find(p => p.buildingId === buildingId)

/** 등록된 안내도가 있으면 그것, 없으면 약도용 빈 안내도. 모르는 건물이면 undefined */
export function planFor(buildingId: string | null | undefined, plans: IndoorPlan[] = INDOOR): IndoorPlan | undefined {
  const p = indoorPlan(buildingId, plans)
  if (p) return p
  return buildingId && buildingById(buildingId) ? { buildingId, floors: [], source: '' } : undefined
}

/** 건물까지 거리(m): 출입구가 있으면 가장 가까운 출입구, 없으면 중심에서 벽까지 뺀 값. 건물 좌표를 모르면 null */
export function distanceToPlan(plan: IndoorPlan, pos: LatLng): number | null {
  if (plan.entrances?.length) return Math.min(...plan.entrances.map(e => distance(pos, e)))
  const b = buildingById(plan.buildingId)
  return b ? Math.max(0, distance(pos, b) - (plan.halfSize ?? DEFAULT_HALF)) : null
}

/** GPS 오차(m)를 넣은 "가까움" 기준 */
export const nearLimit = (acc?: number | null) => Math.min(NEAR_MAX_M, Math.max(NEAR_M, acc != null && Number.isFinite(acc) ? acc : 0))

/**
 * 지금 위치에서 실내 안내도를 띄울 건물(등록된 안내도만). current(이미 띄운 건물)는 LEAVE_M까지 유지한다.
 * prefer(가는 건물)가 가까우면 그 건물을 먼저 고른다
 */
export function nearbyPlan(pos: LatLng | null, opts: { current?: string | null; prefer?: string | null; plans?: IndoorPlan[]; acc?: number | null } = {}): IndoorPlan | null {
  const id = nearIndoor(pos, { ...opts, ids: (opts.plans ?? INDOOR).map(p => p.buildingId) })
  return id ? indoorPlan(id, opts.plans ?? INDOOR) ?? null : null
}

/**
 * GPS 오차 범위 안에서 다가간 건물 id. ids: 살펴볼 건물(안내도가 있는 건물과 가는 건물).
 * current는 LEAVE_M(오차가 크면 그만큼 더)까지 유지하고, prefer가 가까우면 먼저 고른다
 */
export function nearIndoor(pos: LatLng | null, opts: { ids: string[]; acc?: number | null; current?: string | null; prefer?: string | null; plans?: IndoorPlan[] }): string | null {
  if (!pos) return null
  const plans = opts.plans ?? INDOOR
  const limit = nearLimit(opts.acc)
  const cur = opts.current ? planFor(opts.current, plans) : undefined
  if (cur) {
    const d = distanceToPlan(cur, pos)
    if (d != null && d <= Math.max(LEAVE_M, limit)) return cur.buildingId
  }
  const near = [...new Set(opts.ids)]
    .map(id => planFor(id, plans))
    .filter((p): p is IndoorPlan => !!p)
    .map(p => ({ id: p.buildingId, d: distanceToPlan(p, pos) }))
    .filter((x): x is { id: string; d: number } => x.d != null && x.d <= limit)
    .sort((a, b) => (a.id === opts.prefer ? -1 : b.id === opts.prefer ? 1 : a.d - b.d))
  return near[0]?.id ?? null
}

/** 호수에서 층: 311 → 3, 1205 → 12, B101 → -1. 모르면 null */
export function floorOfRoom(roomNo: string | null | undefined): number | null {
  const s = (roomNo ?? '').trim().toUpperCase()
  const b = s.match(/^B(\d)/)
  if (b) return -Number(b[1])
  const m = s.match(/^(\d{3,4})/)
  if (!m) return null
  const n = m[1]
  return Number(n.length === 3 ? n[0] : n.slice(0, 2)) || null
}

/** 보여 줄 층: 가는 층이 있으면 그 층, 없으면 1층(없으면 가장 낮은 층) */
export function startFloor(plan: IndoorPlan, want?: number | null): number {
  const floors = plan.floors.map(f => f.floor).sort((a, b) => a - b)
  if (want != null && floors.includes(want)) return want
  return floors.includes(1) || !floors.length ? 1 : floors[0]
}

/** 고를 수 있는 층: 등록된 층 + 1층 + 가는 층 */
export function indoorFloors(plan: IndoorPlan, want?: number | null): number[] {
  return [...new Set([...plan.floors.map(f => f.floor), 1, ...(want != null ? [want] : [])])].sort((a, b) => a - b)
}

/** 층 정보. 등록 안 된 층은 약도용 빈 층 */
export const floorOf = (plan: IndoorPlan, n: number): IndoorFloor => plan.floors.find(f => f.floor === n) ?? { floor: n, north: 0 }

/** 안내도 위에서 휴대폰이 가리키는 방향(이미지 위쪽 = 0) */
export const headingOnPlan = (heading: number, floor: IndoorFloor) => (((heading - floor.north) % 360) + 360) % 360

// ── 층별 길 ─────────────────────────────────────────

/** 약도 배치: 아래 가운데 입구, 가운데 세로 복도, 복도 가운데 엘리베이터, 강의실은 호수로 좌우·위아래 자리를 정한다 */
export const SKETCH = { entrance: { x: 0.5, y: 0.94 }, elevator: { x: 0.5, y: 0.55 }, corridorX: 0.5 } as const

/** 약도에서 강의실 자리: 끝 두 자리가 홀수면 왼쪽, 짝수면 오른쪽, 번호가 클수록 위 */
export function sketchRoom(roomNo: string): IndoorPoint {
  const n = Number((roomNo.match(/(\d{1,2})\D*$/) ?? [])[1] ?? 0)
  const row = Math.floor(n / 2) % 8
  return { x: n % 2 ? 0.2 : 0.8, y: Math.round((0.82 - row * 0.09) * 100) / 100 }
}

export type IndoorStop = 'entrance' | 'elevator' | 'room'
export interface IndoorLeg {
  floor: number
  from: IndoorStop
  to: IndoorStop
  /** 안내도 위 경로(0~1 비율) */
  path: IndoorPoint[]
  /** 등록된 위치가 아니라 약도 자리로 그렸는지 */
  sketch: boolean
}
export interface IndoorRoute {
  roomNo: string | null
  /** 가는 층(모르면 null) */
  floor: number | null
  /** 1층(입구 → 엘리베이터 또는 강의실), 가는 층(엘리베이터 → 강의실). 그 사이는 엘리베이터 이동 */
  legs: IndoorLeg[]
}

const dist2 = (a: IndoorPoint, b: IndoorPoint) => Math.hypot(a.x - b.x, a.y - b.y)
const same = (a: IndoorPoint, b: IndoorPoint) => dist2(a, b) < 1e-6

/** 이어진 복도 위에서 가장 짧은 길(다익스트라). 출발·도착은 가장 가까운 복도 지점에 붙인다. 복도가 없으면 null */
export function corridorPath(floor: IndoorFloor, from: IndoorPoint, to: IndoorPoint): IndoorPoint[] | null {
  const nodes = floor.nodes ?? {}
  const ids = Object.keys(nodes)
  if (!ids.length || !floor.edges?.length) return null
  const nearest = (p: IndoorPoint) => ids.reduce((best, id) => (dist2(nodes[id], p) < dist2(nodes[best], p) ? id : best), ids[0])
  const s = nearest(from)
  const e = nearest(to)
  const adj = new Map<string, string[]>(ids.map(id => [id, []]))
  for (const [a, b] of floor.edges) {
    if (!nodes[a] || !nodes[b]) continue
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  const d = new Map<string, number>(ids.map(id => [id, Infinity]))
  const prev = new Map<string, string>()
  const left = new Set(ids)
  d.set(s, 0)
  while (left.size) {
    let u: string | null = null
    for (const id of left) if (u == null || d.get(id)! < d.get(u)!) u = id
    if (u == null || d.get(u) === Infinity) break
    left.delete(u)
    if (u === e) break
    for (const v of adj.get(u)!) {
      const alt = d.get(u)! + dist2(nodes[u], nodes[v])
      if (alt < d.get(v)!) { d.set(v, alt); prev.set(v, u) }
    }
  }
  if (d.get(e) === Infinity) return null
  const chain: IndoorPoint[] = []
  for (let c: string | undefined = e; c; c = prev.get(c)) chain.unshift(nodes[c])
  return dedupe([from, ...chain, to])
}

const dedupe = (pts: IndoorPoint[]) => pts.filter((p, i) => i === 0 || !same(p, pts[i - 1]))

/** 복도가 없으면 세로 복도(corridorX)를 따라 꺾어서 간다 */
function elbow(from: IndoorPoint, to: IndoorPoint, corridorX: number): IndoorPoint[] {
  return dedupe([from, { x: corridorX, y: from.y }, { x: corridorX, y: to.y }, to])
}

function pointOf(plan: IndoorPlan, floor: IndoorFloor, stop: IndoorStop, roomNo: string | null): { p: IndoorPoint; sketch: boolean } {
  if (stop === 'entrance') {
    const p = floor.entrance ?? plan.entrances?.find(e => e.floor === floor.floor)?.at
    return p ? { p, sketch: false } : { p: SKETCH.entrance, sketch: true }
  }
  if (stop === 'elevator') {
    const p = floor.elevator ?? floor.stairs?.[0]
    return p ? { p, sketch: false } : { p: SKETCH.elevator, sketch: true }
  }
  const p = roomNo ? floor.rooms?.[roomNo] : undefined
  return p ? { p, sketch: false } : { p: sketchRoom(roomNo ?? ''), sketch: true }
}

function leg(plan: IndoorPlan, n: number, from: IndoorStop, to: IndoorStop, roomNo: string | null): IndoorLeg {
  const floor = floorOf(plan, n)
  const a = pointOf(plan, floor, from, roomNo)
  const b = pointOf(plan, floor, to, roomNo)
  const sketch = a.sketch || b.sketch || !floor.image
  const path = (!sketch && corridorPath(floor, a.p, b.p)) || elbow(a.p, b.p, a.sketch && b.sketch ? SKETCH.corridorX : a.p.x)
  return { floor: n, from, to, path, sketch }
}

/**
 * 실내 길: 1층 입구 → 엘리베이터, 엘리베이터로 가는 층, 그 층 엘리베이터 → 강의실.
 * 강의실이 1층이면 입구 → 강의실 한 번. 강의실을 모르면 1층 입구 → 엘리베이터만
 */
export function indoorRoute(plan: IndoorPlan, room?: { roomNo: string | null; floor: number | null } | null): IndoorRoute {
  const roomNo = room?.roomNo?.trim() || null
  const floor = room?.floor ?? floorOfRoom(roomNo)
  if (!roomNo || floor == null) return { roomNo, floor, legs: [leg(plan, 1, 'entrance', 'elevator', null)] }
  if (floor === 1) return { roomNo, floor, legs: [leg(plan, 1, 'entrance', 'room', roomNo)] }
  return { roomNo, floor, legs: [leg(plan, 1, 'entrance', 'elevator', roomNo), leg(plan, floor, 'elevator', 'room', roomNo)] }
}

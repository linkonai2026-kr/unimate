// 건물 실내 안내도: 층별 이미지와, 이미지 위 위치(가로·세로 0~1 비율).
// 이미지는 web/public/indoor/<건물 id>/<층>.<확장자>에 두고 여기 등록한다.
// north: 이미지 위쪽이 실제로 가리키는 방위(0 = 북쪽, 90 = 동쪽). 휴대폰 방향을 안내도 위에 맞출 때 쓴다
import { buildingById, type LatLng } from './buildings'
import { distance } from './route'

export interface IndoorPoint { x: number; y: number }
export interface IndoorEntrance extends LatLng { name?: string; floor: number; at: IndoorPoint }
export interface IndoorFloor {
  floor: number
  image: string
  north: number
  /** 호수 → 안내도 위 위치. 없으면 층 안내만 한다 */
  rooms?: Record<string, IndoorPoint>
  /** 계단·엘리베이터 위치(다른 층으로 가야 할 때 표시) */
  stairs?: IndoorPoint[]
}
export interface IndoorPlan {
  buildingId: string
  floors: IndoorFloor[]
  /** 출입구 좌표. 있으면 출입구 기준으로 가까움을 잰다 */
  entrances?: IndoorEntrance[]
  /** 출입구 좌표가 없을 때: 건물 중심에서 벽까지 대략 거리(m) */
  halfSize?: number
  /** 안내도 출처 표시 */
  source: string
}

/** 건물(출입구)에서 이 거리 안이면 실내 안내도로 바꾼다 */
export const NEAR_M = 10
/** 바꾼 뒤 이만큼 더 멀어져야 실외로 돌아간다(GPS가 흔들려서 화면이 왔다 갔다 하지 않게) */
export const LEAVE_M = 25
const DEFAULT_HALF = 20

export const INDOOR: IndoorPlan[] = [
  {
    buildingId: 'greenenergy',
    // 입구 안내도(현장 촬영)를 다시 그린 것. 위쪽 방위는 현장에서 확인 전까지 북쪽으로 둔다
    floors: [{ floor: 1, image: '/indoor/greenenergy/1.png', north: 0 }],
    halfSize: 22,
    source: '그린에너지연구관 1층 건물 안내도',
  },
]

export const indoorPlan = (buildingId: string | null | undefined, plans: IndoorPlan[] = INDOOR) => plans.find(p => p.buildingId === buildingId)

/** 건물까지 거리(m): 출입구가 있으면 가장 가까운 출입구, 없으면 중심에서 벽까지 뺀 값. 건물 좌표를 모르면 null */
export function distanceToPlan(plan: IndoorPlan, pos: LatLng): number | null {
  if (plan.entrances?.length) return Math.min(...plan.entrances.map(e => distance(pos, e)))
  const b = buildingById(plan.buildingId)
  return b ? Math.max(0, distance(pos, b) - (plan.halfSize ?? DEFAULT_HALF)) : null
}

/**
 * 지금 위치에서 실내 안내도를 띄울 건물. current(이미 띄운 건물)는 LEAVE_M까지 유지한다.
 * prefer(가는 건물)가 가까우면 그 건물을 먼저 고른다
 */
export function nearbyPlan(pos: LatLng | null, opts: { current?: string | null; prefer?: string | null; plans?: IndoorPlan[] } = {}): IndoorPlan | null {
  if (!pos) return null
  const plans = opts.plans ?? INDOOR
  const cur = indoorPlan(opts.current, plans)
  if (cur) {
    const d = distanceToPlan(cur, pos)
    if (d != null && d <= LEAVE_M) return cur
  }
  const near = plans
    .map(p => ({ p, d: distanceToPlan(p, pos) }))
    .filter((x): x is { p: IndoorPlan; d: number } => x.d != null && x.d <= NEAR_M)
    .sort((a, b) => (a.p.buildingId === opts.prefer ? -1 : b.p.buildingId === opts.prefer ? 1 : a.d - b.d))
  return near[0]?.p ?? null
}

/** 보여 줄 층: 가는 층이 있으면 그 층, 없으면 1층(없으면 가장 낮은 층) */
export function startFloor(plan: IndoorPlan, want?: number | null): number {
  const floors = plan.floors.map(f => f.floor).sort((a, b) => a - b)
  if (want != null && floors.includes(want)) return want
  return floors.includes(1) ? 1 : floors[0]
}

/** 안내도 위에서 휴대폰이 가리키는 방향(이미지 위쪽 = 0) */
export const headingOnPlan = (heading: number, floor: IndoorFloor) => (((heading - floor.north) % 360) + 360) % 360

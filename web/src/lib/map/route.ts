// TMAP 보행자 경로(없으면 직선), 출발점 선택, 데모용 걷기 시뮬레이션, 안내 중 상태 계산
import { has } from '../env'
import { withTimeout } from '../timeout'
import { CAMPUS_CENTER, CAMPUS_GATE, type LatLng } from './buildings'

/** TMAP turnType: 11 직진, 12 좌회전, 13 우회전, 14 유턴, 16·17 8·10시, 18·19 2·4시, 125 육교, 126 지하보도, 127 계단, 128 경사로, 200 출발, 201 도착, 211~217 횡단보도 */
export type Step = { pos: LatLng; text: string; turn: number }
export type Route = { coords: LatLng[]; meters: number; seconds: number; steps: Step[]; source: 'tmap' | 'straight' }

/** 도착지는 캠퍼스 둘레 3km 안, 출발지가 20km보다 멀면 TMAP을 부르지 않고 직선(외부 API 사용량 보호) */
export const DEST_RADIUS_M = 3000
export const TMAP_START_RADIUS_M = 20_000
const WALK_MPS = 4500 / 3600

export function distance(a: LatLng, b: LatLng): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const isLatLng = (p: unknown): p is LatLng => {
  const v = p as Partial<LatLng> | null
  return !!v && typeof v.lat === 'number' && typeof v.lng === 'number' && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
}

/** "37.45,129.16" 꼴만 받는다(빈 값·숫자 세 개·지수 표기 등은 거절) */
export function parseLatLng(v: string | null | undefined): LatLng | null {
  const m = /^\s*(-?\d{1,3}(?:\.\d{1,20})?)\s*,\s*(-?\d{1,3}(?:\.\d{1,20})?)\s*$/.exec(v ?? '')
  if (!m) return null
  const p = { lat: Number(m[1]), lng: Number(m[2]) }
  return isLatLng(p) ? p : null
}

export const nearCampus = (p: LatLng, meters: number) => distance(p, CAMPUS_CENTER) <= meters

type TmapFeature = { geometry?: { type?: unknown; coordinates?: unknown }; properties?: { totalDistance?: unknown; totalTime?: unknown; description?: unknown; turnType?: unknown } }
type TmapJson = { features?: unknown }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const toLatLng = (c: unknown): LatLng | null => {
  if (!Array.isArray(c) || c.length < 2) return null
  const p = { lat: num(c[1]) ?? NaN, lng: num(c[0]) ?? NaN }
  return isLatLng(p) ? p : null
}

/** 경로 길이(m) */
function pathLength(coords: LatLng[]): number {
  let m = 0
  for (let i = 1; i < coords.length; i++) m += distance(coords[i - 1], coords[i])
  return m
}

/** TMAP 응답을 경로로. 모양이 이상한 지점·좌표는 건너뛰고, 거리·시간이 없으면 좌표로 계산한다 */
export function parseTmap(json: TmapJson): Omit<Route, 'source'> {
  const features: TmapFeature[] = Array.isArray(json?.features) ? json.features : []
  const coords: LatLng[] = []
  const steps: Step[] = []
  for (const f of features) {
    const g = f?.geometry
    if (g?.type === 'Point') {
      const pos = toLatLng(g.coordinates)
      if (pos) steps.push({ pos, text: typeof f.properties?.description === 'string' ? f.properties.description : '', turn: num(f.properties?.turnType) ?? 11 })
    } else if (g?.type === 'LineString' && Array.isArray(g.coordinates)) {
      for (const c of g.coordinates) {
        const p = toLatLng(c)
        const last = coords.at(-1)
        if (p && (!last || last.lat !== p.lat || last.lng !== p.lng)) coords.push(p)
      }
    }
  }
  // 단계 안내가 비면 출발·도착만이라도 둔다
  if (steps.length === 0 && coords.length > 1) steps.push({ pos: coords[0], text: '', turn: 200 }, { pos: coords[coords.length - 1], text: '', turn: 201 })
  const p = features[0]?.properties ?? {}
  const meters = num(p.totalDistance) ?? Math.round(pathLength(coords))
  return { coords, steps, meters, seconds: num(p.totalTime) ?? Math.round(meters / WALK_MPS) }
}

/** 직선 대역(경로 서비스가 없거나 실패했을 때) */
export function straightRoute(from: LatLng, to: LatLng): Route {
  const meters = Math.round(distance(from, to))
  return { coords: [from, to], meters, seconds: Math.round(meters / WALK_MPS), steps: [{ pos: from, text: '', turn: 200 }, { pos: to, text: '', turn: 201 }], source: 'straight' }
}

const TMAP_TIMEOUT_MS = 5000

async function tmap(from: LatLng, to: LatLng, signal: AbortSignal): Promise<Route> {
  const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', {
    method: 'POST',
    headers: { appKey: (process.env.TMAP_APP_KEY ?? '').trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ startX: from.lng, startY: from.lat, endX: to.lng, endY: to.lat, startName: 'start', endName: 'end', reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO' }),
    cache: 'no-store',
    signal,
  })
  // 오류 내용에는 상태 코드만 남긴다(요청 헤더의 키가 로그로 새지 않게)
  if (!res.ok) throw new Error(`TMAP ${res.status}`)
  const r = parseTmap(await res.json())
  if (r.coords.length < 2) throw new Error('TMAP empty route')
  return { ...r, source: 'tmap' }
}

/** 도보 경로. 절대 예외를 내지 않는다(실패·시간 초과·먼 출발지는 직선) */
export async function getWalkingRoute(from: LatLng, to: LatLng): Promise<Route> {
  if (!has.tmap || !nearCampus(from, TMAP_START_RADIUS_M)) return straightRoute(from, to)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TMAP_TIMEOUT_MS)
  try {
    return await withTimeout(tmap(from, to, ctrl.signal), TMAP_TIMEOUT_MS, () => straightRoute(from, to))
  } finally {
    clearTimeout(timer)
    ctrl.abort()
  }
}

/** 내 위치 둘레 원 반지름(m): GPS가 알려 준 정확도. 없으면 12m, 너무 작거나(점에 가려짐) 크면(화면을 덮음) 5~150m로 자른다 */
export const accuracyRadius = (acc?: number | null) => (acc == null || !Number.isFinite(acc) ? 12 : Math.min(150, Math.max(5, acc)))

/** GPS가 있으면 항상 내 위치에서 출발(캠퍼스에서 2km 넘게 떨어지면 far 표시만). GPS가 없을 때만 정문 */
export function pickStart(geo: LatLng | null): { pos: LatLng; reason: 'gps' | 'denied' | 'far' } {
  if (!geo || !isLatLng(geo)) return { pos: CAMPUS_GATE, reason: 'denied' }
  return { pos: geo, reason: nearCampus(geo, 2000) ? 'gps' : 'far' }
}

/** 경로를 따라 위치 점을 움직인다(데모 모드). 정지 함수를 돌려준다 */
export function simulateWalk(coords: LatLng[], onPos: (p: LatLng) => void, speedMps = 6): () => void {
  if (coords.length === 0) return () => {}
  if (coords.length === 1 || speedMps <= 0) {
    onPos(coords[coords.length - 1])
    return () => {}
  }
  const TICK = 200
  let seg = 0, along = 0
  const timer = setInterval(() => {
    along += (speedMps * TICK) / 1000
    while (seg < coords.length - 1 && along >= distance(coords[seg], coords[seg + 1])) {
      along -= distance(coords[seg], coords[seg + 1])
      seg++
    }
    if (seg >= coords.length - 1) {
      clearInterval(timer)
      onPos(coords[coords.length - 1])
      return
    }
    const a = coords[seg], b = coords[seg + 1], k = along / distance(a, b)
    onPos({ lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k })
  }, TICK)
  return () => clearInterval(timer)
}

/** 경로 위 누적 거리(m) */
function cumulative(coords: LatLng[]): number[] {
  const out = [0]
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + distance(coords[i - 1], coords[i]))
  return out
}

/** 점을 경로에 투영했을 때 경로까지의 거리(d, m)와 출발점부터의 거리(along, m). 좌표가 하나뿐이면 그 점까지의 거리 */
function project(coords: LatLng[], acc: number[], p: LatLng): { d: number; along: number } {
  if (coords.length === 0) return { d: Infinity, along: 0 }
  if (coords.length === 1) return { d: distance(p, coords[0]), along: 0 }
  let best = { d: Infinity, along: 0 }
  const kx = Math.cos((p.lat * Math.PI) / 180)
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1]
    const ax = a.lng * kx, ay = a.lat, bx = b.lng * kx, by = b.lat, px = p.lng * kx, py = p.lat
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2
    const u = len2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2)) : 0
    const q = { lat: a.lat + (b.lat - a.lat) * u, lng: a.lng + (b.lng - a.lng) * u }
    const d = distance(p, q)
    if (d < best.d) best = { d, along: acc[i] + distance(a, q) }
  }
  return best
}

/** 경로에서 40m 넘게 벗어났는지(경로 다시 찾기 판단) */
export const offRoute = (route: Route, me: LatLng, limit = 40) => project(route.coords, cumulative(route.coords), me).d > limit

/** 안내 중 상태: 다음 단계 번호, 다음 단계까지·도착까지 남은 거리, 도착 여부 */
export function navState(route: Route, me: LatLng): { next: number; toNext: number; remaining: number; arrived: boolean } {
  const { coords, steps } = route
  const end = coords[coords.length - 1]
  if (!end) return { next: 0, toNext: 0, remaining: 0, arrived: false }
  const acc = cumulative(coords)
  const total = acc[acc.length - 1]
  const here = project(coords, acc, me).along
  const stepAlong = steps.map(s => project(coords, acc, s.pos).along)
  let next = stepAlong.findIndex(a => a > here + 10)
  if (next < 0) next = Math.max(0, steps.length - 1)
  const target = stepAlong[next] ?? total
  return {
    next,
    toNext: Math.max(0, Math.round(target - here)),
    remaining: Math.max(0, Math.round(total - here)),
    arrived: distance(me, end) < 30,
  }
}

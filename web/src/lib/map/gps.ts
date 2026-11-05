// 휴대폰 GPS 값 다듬기. 캠퍼스 건물 사이에서는 값이 10~30m씩 튀어서 내 위치 점이 흔들리고 엉뚱한 건물 옆에 찍힌다.
// 1) 칼만 필터: 정확도가 나쁜 값은 덜 믿고, 시간이 지난 만큼만(걷는 속도) 움직였을 수 있다고 본다
// 2) 안내 중에는 경로 가까이(15m)면 점을 경로 위로 붙인다
import type { LatLng } from './buildings'
import { distance, snapPoint, type Route } from './route'

export type Fix = { pos: LatLng; acc: number; at: number }

/** 걷는 사람이 1초에 움직일 수 있다고 보는 거리(m). 클수록 새 값을 빨리 따라간다 */
const WALK_MPS = 3
/** GPS가 말하는 정확도는 이보다 좋을 수 없다고 본다(m) */
const MIN_ACC = 3
/** 이보다 나쁜 값은(실내·건물 그늘) 지금 추정이 더 정확하면 버린다(m) */
const BAD_ACC = 60

/** 정확한 값(이 정확도 이하)이 지금 추정의 오차 범위 3배 밖이면 실제로 옮겨 간 것으로 보고 바로 따라간다(m) */
const GOOD_ACC = 25

export function createGpsFilter(walkMps = WALK_MPS) {
  let est: Fix | null = null
  /** 지금 추정 위치의 오차 분산(m²) */
  let variance = 0
  /** 마지막으로 받아들인 값의 GPS 정확도(화면 표시용: 휴대폰이 알려 준 값 그대로) */
  let shown = 0
  const restart = (f: Fix, acc: number) => {
    est = { ...f, acc }
    variance = acc * acc
    shown = acc
    return { pos: f.pos, acc }
  }
  return {
    push(f: Fix): { pos: LatLng; acc: number } {
      const acc = Math.max(MIN_ACC, Number.isFinite(f.acc) ? f.acc : BAD_ACC)
      if (!est || f.at < est.at) return restart(f, acc)
      const dt = (f.at - est.at) / 1000
      variance += dt * walkMps * walkMps
      // 정확도가 나쁜 튄 값: 지금 추정이 훨씬 정확하면 무시한다(시간이 지나 추정이 흐려지면 다시 받아들인다)
      if (acc > BAD_ACC && acc * acc > variance * 4) {
        est = { ...est, at: f.at }
        return { pos: est.pos, acc: shown }
      }
      // 정확한 값이 오차 범위를 크게 벗어나면: 처음 잡은 위치가 틀렸거나 정말 옮겨 간 것. 천천히 끌려가지 않고 바로 옮긴다
      if (acc <= GOOD_ACC && distance(est.pos, f.pos) > 3 * Math.sqrt(variance + acc * acc)) return restart(f, acc)
      const k = variance / (variance + acc * acc)
      const pos = { lat: est.pos.lat + k * (f.pos.lat - est.pos.lat), lng: est.pos.lng + k * (f.pos.lng - est.pos.lng) }
      variance = (1 - k) * variance
      est = { pos, acc: Math.sqrt(variance), at: f.at }
      shown = acc
      return { pos, acc }
    },
    reset() { est = null; variance = 0 },
  }
}

/** 안내 중 화면에 찍을 위치: 경로에서 limit(m) 안이면 경로 위 가장 가까운 점, 아니면 그대로 */
export function onRoute(route: Route | null, p: LatLng, limit = 15): LatLng {
  if (!route) return p
  const s = snapPoint(route.coords, p)
  return s && s.d <= limit ? s.pos : p
}

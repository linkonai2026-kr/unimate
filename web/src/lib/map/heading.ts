// 휴대폰이 바라보는 방향(나침반) 계산. 0 = 북쪽, 시계 방향으로 커진다(90 = 동쪽).
// 아이폰은 webkitCompassHeading(이미 나침반 각도), 안드로이드는 deviceorientationabsolute의 alpha(반시계 방향)를 준다.
import type { LatLng } from './buildings'

/** 0~360으로 맞춘다 */
export const norm = (deg: number) => ((deg % 360) + 360) % 360

/** a에서 b로 돌 때 가장 짧은 각도(-180~180, 양수면 시계 방향) */
export const turnBy = (from: number, to: number) => {
  const d = norm(to - from)
  return d > 180 ? d - 360 : d
}

type OrientationLike = { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number }

/**
 * 방향 센서 이벤트 → 나침반 각도. 북쪽을 모르는 값(상대 각도)이면 null.
 * screenAngle: 화면 회전 각도(가로로 눕히면 90·270). 화면 위쪽이 가리키는 방향을 돌려준다
 */
export function headingFrom(e: OrientationLike, screenAngle = 0): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) {
    // 아이폰 값은 화면 회전과 상관없이 기기 위쪽 기준이다
    return norm(e.webkitCompassHeading + screenAngle)
  }
  if (!e.absolute || e.alpha == null || !Number.isFinite(e.alpha)) return null
  return norm(360 - e.alpha + screenAngle)
}

/** 센서 값이 떨려서 부드럽게 따라간다(0과 360 경계를 넘을 때도 짧은 쪽으로) */
export const smooth = (prev: number | null, next: number, k = 0.25) => (prev == null ? next : norm(prev + turnBy(prev, next) * k))

/** a에서 b를 바라보는 방위각(0 = 북쪽) */
export function bearing(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad)
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad)
  return norm(Math.atan2(y, x) / rad)
}

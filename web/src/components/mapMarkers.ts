// 두 지도(카카오·Leaflet)가 같이 쓰는 내 위치 표시: 파란 점과 휴대폰 방향 부채꼴
/** 내 위치 둘레의 방향 부채꼴(위쪽을 가리키게 그리고 방향만큼 돌린다) */
const CONE_HTML = '<span data-cone style="display:block;width:64px;height:64px;border-radius:50%;background:conic-gradient(from -32deg,rgba(59,130,246,.55),rgba(59,130,246,.12) 64deg,transparent 64deg);-webkit-mask:radial-gradient(circle,#000 0 70%,transparent 71%);mask:radial-gradient(circle,#000 0 70%,transparent 71%);transition:transform .15s linear"></span>'
/** 내 위치 표시: 방향 부채꼴 위에 파란 점(둘 다 지도 위 좌표가 한가운데) */
export const ME_HTML = `<span style="position:relative;display:block;width:64px;height:64px">${CONE_HTML}<span style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;box-sizing:border-box;border-radius:50%;border:3px solid #fff;background:#3b82f6;box-shadow:0 1px 4px rgba(0,0,0,.3)"></span></span>`
/** 부채꼴을 방향에 맞춰 돌린다. 방향을 모르면 숨긴다 */
export function aimCone(cone: HTMLElement | null | undefined, heading: number | null | undefined) {
  if (!cone) return
  cone.style.visibility = heading == null ? 'hidden' : 'visible'
  if (heading != null) cone.style.transform = `rotate(${heading}deg)`
}

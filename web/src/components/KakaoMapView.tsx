'use client'
// 카카오맵(키 있을 때): 스카이뷰+한글 지명 하이브리드, 건물 핀·이름표, 경로선, 출발·도착, 내 위치. MapView(Leaflet)와 같은 props, SDK가 안 뜨면 onFail
import { useEffect, useRef } from 'react'
import type { LatLng } from '@/lib/map/buildings'
import { accuracyRadius } from '@/lib/map/route'
import type { Pin } from './MapView'

type Props = {
  appKey: string; center: LatLng; pins: Pin[]; selected?: string; route?: LatLng[]; me?: LatLng | null
  follow?: boolean; startLabel?: string; endLabel?: string; onPick: (id: string) => void
  /** GPS 정확도(m). 내 위치 둘레의 파란 원 크기 */ accuracy?: number
  /** 값이 바뀔 때마다 내 위치로 지도를 옮긴다(위치가 아직 없으면 잡히는 대로) */ recenter?: number
  /** SDK를 못 불러왔을 때(도메인 미등록·차단·네트워크). 부모가 Leaflet 지도로 바꾼다 */ onFail?: () => void
}

// SDK 타입이 없어 쓰는 부분만 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kakao = any
declare global { interface Window { kakao?: Kakao } }

const SDK_TIMEOUT_MS = 10_000
let loading: Promise<Kakao> | null = null

/** SDK 스크립트는 페이지에 한 번만 넣는다. 실패하면 다음에 다시 시도할 수 있게 비운다 */
function loadSdk(appKey: string): Promise<Kakao> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  loading ??= new Promise<Kakao>((resolve, reject) => {
    const fail = (why: string) => { clearTimeout(timer); loading = null; script.remove(); reject(new Error(`kakao sdk: ${why}`)) }
    // 키가 등록되지 않은 도메인이면 maps.load 콜백이 오지 않을 수 있어서 시간 제한을 둔다
    const timer = setTimeout(() => fail('timeout'), SDK_TIMEOUT_MS)
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`
    script.async = true
    script.onload = () => {
      const maps = window.kakao?.maps
      if (!maps?.load) return fail('no maps')
      try {
        maps.load(() => { clearTimeout(timer); resolve(window.kakao) })
      } catch {
        fail('load threw')
      }
    }
    script.onerror = () => fail('script error')
    document.head.appendChild(script)
  })
  return loading
}

const el = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild as HTMLElement }
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const tag = (text: string, bg: string) => `<span style="display:inline-block;white-space:nowrap;background:${bg};color:#fff;font:700 12px/1 system-ui;padding:6px 9px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3)">${esc(text)}</span>`

export default function KakaoMapView({ appKey, center, pins, selected, route, me, follow, startLabel = 'Start', endLabel = 'End', onPick, accuracy, recenter = 0, onFail }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<Kakao>(null)
  const sdk = useRef<Kakao>(null)
  const drawn = useRef<Kakao[]>([])
  const pick = useRef(onPick)
  const failed = useRef(onFail)
  useEffect(() => { pick.current = onPick; failed.current = onFail })

  const draw = useRef(() => {})
  const fit = useRef(() => {})
  useEffect(() => { draw.current = () => {
    const k = sdk.current, m = map.current
    if (!k || !m) return
    drawn.current.forEach(o => o.setMap(null))
    drawn.current = []
    const add = (o: Kakao) => { o.setMap(m); drawn.current.push(o) }
    const ll = (p: LatLng) => new k.maps.LatLng(p.lat, p.lng)
    if (route && route.length > 1) {
      add(new k.maps.Polyline({ path: route.map(ll), strokeWeight: 11, strokeColor: '#ffffff', strokeOpacity: 0.95 }))
      add(new k.maps.Polyline({ path: route.map(ll), strokeWeight: 7, strokeColor: '#27a395', strokeOpacity: 1 }))
    }
    for (const p of pins) {
      const on = p.id === selected
      // 점의 한가운데가 건물 좌표에 오게 한다: 점(버튼)을 좌표에 두고 가운데 정렬, 이름표는 점 바로 위.
      // 멀리서 보면 이름표가 겹쳐서 점만 보이고(.labels-far), 고른 건물은 늘 이름표를 띄운다
      const size = on ? 18 : 14
      const node = el(`<button type="button" aria-label="${esc(p.label)}" aria-pressed="${on}" style="position:relative;display:block;width:${size}px;height:${size}px;transform:translate(-50%,-50%);padding:0;box-sizing:border-box;border-radius:50%;border:2px solid #fff;background:${on ? '#27a395' : '#011d48'};box-shadow:0 1px 3px rgba(0,0,0,.35);cursor:pointer">
        <span class="${on ? '' : 'kpin-label'}" aria-hidden="true" style="position:absolute;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);padding:3px 7px;border-radius:8px;font:700 ${on ? 13 : 11}px/1.2 system-ui;background:${on ? '#27a395' : '#fff'};color:${on ? '#fff' : '#011d48'};box-shadow:0 1px 4px rgba(0,0,0,.25);white-space:nowrap">${esc(p.label)}</span></button>`)
      node.addEventListener('click', () => pick.current(p.id))
      add(new k.maps.CustomOverlay({ position: ll(p), content: node, xAnchor: 0, yAnchor: 0, zIndex: on ? 3 : 2, clickable: true }))
    }
    if (route && route.length > 1) {
      add(new k.maps.CustomOverlay({ position: ll(route[0]), content: el(tag(startLabel, '#011d48')), yAnchor: 1.4, zIndex: 4 }))
      add(new k.maps.CustomOverlay({ position: ll(route[route.length - 1]), content: el(tag(endLabel, '#e5484d')), yAnchor: 1.4, zIndex: 4 }))
    }
    if (me) {
      add(new k.maps.Circle({ center: ll(me), radius: accuracyRadius(accuracy), strokeWeight: 0, fillColor: '#3b82f6', fillOpacity: 0.18 }))
      add(new k.maps.CustomOverlay({ position: ll(me), content: el('<span style="display:block;width:16px;height:16px;border-radius:50%;border:3px solid #fff;background:#3b82f6;box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>'), zIndex: 5 }))
    }
  } })

  useEffect(() => {
    let alive = true
    let cleanup = () => {}
    loadSdk(appKey).then(k => {
      if (!alive || !box.current || map.current) return
      sdk.current = k
      // 레벨은 작을수록 가깝다(1이 가장 가까움). 캠퍼스 전체가 보이는 3에서 시작
      const m = new k.maps.Map(box.current, { center: new k.maps.LatLng(center.lat, center.lng), level: 3 })
      m.setMapTypeId(k.maps.MapTypeId.HYBRID)
      m.addControl(new k.maps.MapTypeControl(), k.maps.ControlPosition.TOPLEFT)
      map.current = m
      // 멀리서 보면 이름표가 겹쳐서, 레벨 3보다 멀면 점만(고른 건물은 이름까지)
      const labels = () => box.current?.classList.toggle('labels-far', m.getLevel() > 3)
      k.maps.event.addListener(m, 'zoom_changed', labels)
      // 화면 크기가 바뀌면(주소창 접힘·회전) 지도 크기를 다시 잡는다
      const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => m.relayout())
      if (box.current) ro?.observe(box.current)
      cleanup = () => { k.maps.event.removeListener(m, 'zoom_changed', labels); ro?.disconnect() }
      // 처음엔 캠퍼스 건물이 모두 보이게
      if (pins.length > 1) {
        const b = new k.maps.LatLngBounds()
        pins.forEach(p => b.extend(new k.maps.LatLng(p.lat, p.lng)))
        m.setBounds(b, 60, 40, 60, 40)
      }
      labels()
      draw.current()
      fit.current()
    }).catch(e => {
      console.warn('[KakaoMapView]', e instanceof Error ? e.message : e)
      if (alive) failed.current?.()
    })
    return () => {
      alive = false
      cleanup()
      drawn.current.forEach(o => o.setMap(null))
      drawn.current = []
      map.current = null
    }
    // 지도는 처음 한 번만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => draw.current(), [pins, selected, route, me, accuracy, startLabel, endLabel])
  useEffect(() => {
    fit.current = () => {
      const k = sdk.current
      if (!k || !map.current || !route || route.length < 2 || follow) return
      const b = new k.maps.LatLngBounds()
      route.forEach(p => b.extend(new k.maps.LatLng(p.lat, p.lng)))
      map.current.setBounds(b, 120, 30, 330, 50)
    }
    fit.current()
  }, [route, follow])
  useEffect(() => {
    const k = sdk.current
    if (!k || !map.current || !follow || !me) return
    if (map.current.getLevel() > 2) map.current.setLevel(2)
    map.current.panTo(new k.maps.LatLng(me.lat, me.lng))
  }, [follow, me])
  const done = useRef(0)
  useEffect(() => {
    const k = sdk.current
    if (!recenter || done.current === recenter || !k || !map.current || !me) return
    done.current = recenter
    if (map.current.getLevel() > 2) map.current.setLevel(2)
    map.current.panTo(new k.maps.LatLng(me.lat, me.lng))
  }, [recenter, me])

  return <div ref={box} className="h-full w-full" />
}

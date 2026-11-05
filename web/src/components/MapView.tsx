'use client'
// Leaflet 지도(키 불필요, 카카오 키가 없거나 카카오가 안 될 때): 위성사진 기본, 건물 핀·이름표, 경로선, 출발·도착 표시, 내 위치(안내 중엔 따라감)
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type * as Leaflet from 'leaflet'
import type { LatLng } from '@/lib/map/buildings'
import { accuracyRadius } from '@/lib/map/route'

/** no: 가이드북 안내도 건물 번호 */
export type Pin = LatLng & { id: string; label: string; no?: number }
type Props = {
  center: LatLng; pins: Pin[]; selected?: string; route?: LatLng[]; me?: LatLng | null
  follow?: boolean; startLabel?: string; endLabel?: string; layerLabels?: [string, string]; onPick: (id: string) => void
  /** GPS 정확도(m). 내 위치 둘레의 파란 원 크기 */ accuracy?: number
  /** 값이 바뀔 때마다 내 위치로 지도를 옮긴다(위치가 아직 없으면 잡히는 대로) */ recenter?: number
}

// 위성사진 원본은 18배율까지. 그 위로는 받아 둔 사진을 늘려서 빈 타일(깨짐)이 안 보이게 한다
const MAX_ZOOM = 20
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const tag = (text: string, bg: string) => `<span style="display:inline-block;transform:translate(-50%,-115%);white-space:nowrap;background:${bg};color:#fff;font:700 12px/1 system-ui;padding:6px 9px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3)">${esc(text)}</span>`
const pt = (p: LatLng) => [p.lat, p.lng] as [number, number]

/** 점(SVG)과 이름표를 버튼처럼: 화면 낭독기 이름, Tab 이동, Enter·Space로 고르기 */
function asButton(node: Element | undefined, label: string, onPick: () => void) {
  if (!node) return
  node.setAttribute('role', 'button')
  node.setAttribute('aria-label', label)
  node.setAttribute('tabindex', '0')
  node.addEventListener('keydown', e => {
    const k = (e as KeyboardEvent).key
    if (k === 'Enter' || k === ' ') { e.preventDefault(); onPick() }
  })
}

export default function MapView({ center, pins, selected, route, me, follow, startLabel = 'Start', endLabel = 'End', layerLabels = ['Satellite', 'Map'], onPick, accuracy, recenter = 0 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  const layer = useRef<Leaflet.LayerGroup | null>(null)
  const L = useRef<typeof Leaflet | null>(null)
  const pick = useRef(onPick)
  useEffect(() => { pick.current = onPick })

  const draw = useRef(() => {})
  // 지도가 경로보다 늦게 준비될 수 있어서, 준비된 직후에도 한 번 맞춘다
  const fit = useRef(() => {})
  // 렌더마다 최신 props로 그리는 함수를 갈아 끼운다(아래 효과들보다 먼저 실행)
  useEffect(() => { draw.current = () => {
    const mod = L.current, g = layer.current
    if (!mod || !g) return
    g.clearLayers()
    const line = route && route.length > 1 ? route.map(pt) : null
    if (line) {
      mod.polyline(line, { color: '#ffffff', weight: 11, opacity: 0.95, interactive: false }).addTo(g)
      mod.polyline(line, { color: '#27a395', weight: 7, opacity: 1, interactive: false }).addTo(g)
    }
    for (const p of pins) {
      const on = p.id === selected
      const choose = () => pick.current(p.id)
      const dot = mod.circleMarker(pt(p), { radius: on ? 10 : 7, color: '#fff', weight: 2, fillColor: on ? '#27a395' : '#011d48', fillOpacity: 1 })
        // 위성사진 지명이 영어·띄엄띄엄이라, 캠퍼스 건물 이름은 사용자 언어로 띄워 둔다(멀리서는 점만)
        .bindTooltip(`<span class="pin-name">${esc(p.label)}</span>`, { permanent: true, direction: 'top', offset: [0, -8], className: on ? 'pin-label pin-label-on' : 'pin-label', interactive: true })
        .on('click', choose).addTo(g)
      // 점이 작아서 이름표도 누르면 고르게 한다. 점에는 건물 이름을 붙여 화면 낭독기·테스트가 이름으로 찾게 한다
      dot.getTooltip()?.getElement()?.addEventListener('click', choose)
      asButton(dot.getElement(), p.label, choose)
    }
    if (line) {
      const icon = (html: string) => mod.divIcon({ html, className: '', iconSize: [0, 0] })
      mod.marker(line[0], { icon: icon(tag(startLabel, '#011d48')), interactive: false, keyboard: false }).addTo(g)
      mod.marker(line[line.length - 1], { icon: icon(tag(endLabel, '#e5484d')), interactive: false, keyboard: false }).addTo(g)
    }
    if (me) {
      mod.circle(pt(me), { radius: accuracyRadius(accuracy), color: '#3b82f6', weight: 0, fillOpacity: 0.18, interactive: false }).addTo(g)
      mod.circleMarker(pt(me), { radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1, interactive: false }).addTo(g)
    }
  } })

  useEffect(() => {
    let alive = true
    let frame = 0
    import('leaflet').then(mod => {
      if (!alive || !box.current || map.current) return
      L.current = mod
      const m = mod.map(box.current, { zoomControl: false, maxZoom: MAX_ZOOM, zoomSnap: 0.25 }).setView(pt(center), 17)
      const satellite = mod.layerGroup([
        mod.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 18, maxZoom: MAX_ZOOM, attribution: 'Tiles © Esri, Maxar, Earthstar Geographics' }),
        mod.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 18, maxZoom: MAX_ZOOM }),
      ]).addTo(m)
      const streets = mod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: MAX_ZOOM, attribution: '© OpenStreetMap' })
      mod.control.layers({ [layerLabels[0]]: satellite, [layerLabels[1]]: streets }, undefined, { position: 'topleft' }).addTo(m)
      layer.current = mod.layerGroup().addTo(m)
      map.current = m
      // 건물이 27곳이라 멀리서 보면 이름표가 겹친다. 17배율 미만에선 점만(고른 건물은 이름까지)
      const labels = () => box.current?.classList.toggle('labels-far', m.getZoom() < 17)
      m.on('zoomend', labels)
      labels()
      draw.current()
      // 상자 크기가 잡힌 다음 프레임에 맞춘다(바로 맞추면 크기 0으로 계산돼 최대 확대로 열린다).
      // 처음엔 캠퍼스 건물 전체, 경로가 있으면 경로
      frame = requestAnimationFrame(() => {
        if (map.current !== m) return
        m.invalidateSize()
        if (pins.length > 1) m.fitBounds(pins.map(pt), { padding: [24, 24] })
        fit.current()
      })
    }).catch(e => console.warn('[MapView]', e instanceof Error ? e.message : e))
    return () => {
      alive = false
      cancelAnimationFrame(frame)
      map.current?.remove()
      map.current = null
      layer.current = null
    }
    // 지도는 처음 한 번만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 화면 크기가 바뀌면(주소창 접힘·회전) 지도 크기를 다시 잡는다
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => map.current?.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => draw.current(), [pins, selected, route, me, accuracy, startLabel, endLabel])
  useEffect(() => {
    fit.current = () => { if (map.current && route && route.length > 1 && !follow) map.current.fitBounds(route.map(pt), { paddingTopLeft: [50, 120], paddingBottomRight: [30, 330] }) }
    fit.current()
  }, [route, follow])
  useEffect(() => {
    if (map.current && follow && me) map.current.setView(pt(me), Math.max(map.current.getZoom(), 18), { animate: true })
  }, [follow, me])
  const done = useRef(0)
  useEffect(() => {
    if (!recenter || done.current === recenter || !map.current || !me) return
    done.current = recenter
    map.current.setView(pt(me), Math.max(map.current.getZoom(), 18), { animate: true })
  }, [recenter, me])

  return <div ref={box} className="h-full w-full" />
}

'use client'
// 지도 탭(네이버 도보 길찾기식): 건물 고르기 → 경로 미리보기(소요 시간·단계 목록) → 안내 모드(다음 행동 배너, 지도 따라가기) → 도착
import { Armchair, ArrowBendUpLeft, ArrowBendUpRight, ArrowUUpLeft, ArrowUp, Barbell, Bed, Briefcase, Bridge, Circle, Coffee, Confetti, FirstAid, FlagCheckered, ForkKnife, GpsFix, HandHeart, Info, PersonSimpleWalk, Phone, Play, Stairs, Storefront, TrafficSignal, TrendDown, TrendUp, X } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { t, type Lang, type UiKey } from '@/lib/i18n'
import type { LatLng } from '@/lib/map/buildings'
import type { FacilityKind, FacilityView } from '@/lib/map/facilities'
import { isLatLng, navState, offRoute, pickStart, simulateWalk, straightRoute, type Route, type Step } from '@/lib/map/route'
import type { Pin } from './MapView'

// 지도 라이브러리는 window가 있어야 해서 브라우저에서만 불러온다
const skeleton = () => <div className="h-full w-full animate-pulse bg-bg-soft" />
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: skeleton })
const KakaoMapView = dynamic(() => import('./KakaoMapView'), { ssr: false, loading: skeleton })

type Props = { lang: Lang; pins: Pin[]; center: LatLng; target?: string; room?: { roomNo: string | null; floor: number | null }; autoStart?: boolean; kakaoKey?: string; facilities?: Record<string, FacilityView[]> }
type Start = ReturnType<typeof pickStart>

const KIND_ICON: Record<FacilityKind, typeof ArrowUp> = { food: ForkKnife, store: Storefront, cafe: Coffee, health: FirstAid, counsel: HandHeart, office: Briefcase, rest: Armchair, sports: Barbell, service: Info, dorm: Bed }
type Mode = 'browse' | 'preview' | 'nav' | 'arrived'

type IconT = typeof ArrowUp
function turnInfo(turn: number): { key: UiKey; Icon: IconT } {
  if (turn === 200) return { key: 'turn_depart', Icon: Circle }
  if (turn === 201) return { key: 'turn_arrive', Icon: FlagCheckered }
  if ([12, 16, 17].includes(turn)) return { key: 'turn_left', Icon: ArrowBendUpLeft }
  if ([13, 18, 19].includes(turn)) return { key: 'turn_right', Icon: ArrowBendUpRight }
  if (turn === 14) return { key: 'turn_uturn', Icon: ArrowUUpLeft }
  if (turn >= 211 && turn <= 217) return { key: 'turn_cross', Icon: TrafficSignal }
  if (turn === 125) return { key: 'turn_bridge', Icon: Bridge }
  if (turn === 126) return { key: 'turn_under', Icon: TrendDown }
  if (turn === 127) return { key: 'turn_stairs', Icon: Stairs }
  if (turn === 128) return { key: 'turn_ramp', Icon: TrendUp }
  return { key: 'turn_straight', Icon: ArrowUp }
}
const stepText = (s: Step, lang: Lang) => s.text || t(lang, turnInfo(s.turn).key)
const mins = (sec: number) => Math.max(1, Math.round(sec / 60))
const noop = () => {}

/** 서버가 돌려준 경로 모양 확인(오류 응답·깨진 응답으로 화면이 죽지 않게) */
function isRoute(v: unknown): v is Route {
  const r = v as Partial<Route> | null
  return !!r && Array.isArray(r.coords) && r.coords.length >= 2 && r.coords.every(isLatLng) && Array.isArray(r.steps) && r.steps.every(s => isLatLng(s?.pos))
    && typeof r.meters === 'number' && typeof r.seconds === 'number'
}

/** 경로 API. 실패(네트워크·429·400·깨진 응답)하면 null */
async function fetchRoute(from: LatLng, to: LatLng, lang: Lang): Promise<Route | null> {
  try {
    const res = await fetch(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&lang=${lang}`)
    if (!res.ok) return null
    const r: unknown = await res.json()
    return isRoute(r) ? r : null
  } catch {
    return null
  }
}

/** 지금 위치 한 번. 권한 창을 그냥 두면 응답이 영영 없어서 10초 뒤엔 위치 없음으로 본다 */
function currentPosition(): Promise<LatLng | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    let settled = false
    const done = (v: LatLng | null) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } }
    const timer = setTimeout(() => done(null), 10_000)
    navigator.geolocation.getCurrentPosition(p => done({ lat: p.coords.latitude, lng: p.coords.longitude }), () => done(null), { enableHighAccuracy: true, timeout: 6000 })
  })
}

export default function MapScreen({ lang, pins, center, target, room, autoStart, kakaoKey, facilities = {} }: Props) {
  const [selected, setSelected] = useState(target)
  const [mode, setMode] = useState<Mode>('browse')
  const [route, setRoute] = useState<Route | null>(null)
  const [start, setStart] = useState<Start | null>(null)
  const [me, setMe] = useState<LatLng | null>(null)
  const [demo, setDemo] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [rerouting, setRerouting] = useState(false)
  const [kakaoFailed, setKakaoFailed] = useState(false)
  const stop = useRef<() => void>(noop)
  /** 경로 요청 번호: 새로 고르거나 안내를 끝내거나 화면을 떠나면 올려서, 늦게 온 옛 응답을 버린다 */
  const seq = useRef(0)
  const lastReroute = useRef(0)
  const dest = pins.find(p => p.id === selected)
  const destLabel = dest ? `${dest.label}${room?.roomNo && dest.id === target ? ` ${room.roomNo}` : ''}` : ''
  const state = route && me ? navState(route, me) : null

  /** 진행 중인 경로 요청·데모 걷기를 모두 멈춘다 */
  const cancel = useCallback(() => {
    seq.current++
    stop.current()
    stop.current = noop
  }, [])

  const plan = useCallback(async (to: Pin, autoNav = false) => {
    cancel()
    const id = seq.current
    setPlanning(true)
    try {
      const s = pickStart(await currentPosition())
      if (id !== seq.current) return
      // 경로 서비스가 안 되면(횟수 제한·오류) 직선으로라도 안내한다
      const r = (await fetchRoute(s.pos, to, lang)) ?? straightRoute(s.pos, to)
      if (id !== seq.current) return
      setStart(s)
      setMe(s.pos)
      setDemo(s.reason === 'denied')
      setRoute(r)
      // 시간표에서 들어오면 GPS가 있을 때 미리보기 없이 바로 안내를 시작한다
      setMode(autoNav && s.reason !== 'denied' ? 'nav' : 'preview')
    } finally {
      if (id === seq.current) setPlanning(false)
    }
  }, [cancel, lang])

  function startNav() {
    if (!route) return
    stop.current()
    stop.current = noop
    setMode('nav')
    if (demo) stop.current = simulateWalk(route.coords, setMe, 10)
  }

  function endNav() {
    cancel()
    setPlanning(false)
    setMode('browse'); setRoute(null); setMe(null)
  }

  // 내 위치(정확도 포함). 둘러보기 중 감시와 안내 중 감시가 함께 채운다
  const [gps, setGps] = useState<{ pos: LatLng; acc: number } | null>(null)
  const [watchOn, setWatchOn] = useState(false)
  const [locError, setLocError] = useState<'denied' | 'https' | null>(null)
  const [recenter, setRecenter] = useState(0)

  // 실시간 GPS: 미리보기·안내 중에 내 위치를 계속 따라간다(데모 모드가 아닐 때)
  const live = (mode === 'preview' || mode === 'nav') && !demo && !!start && start.reason !== 'denied'
  useEffect(() => {
    if (!live || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(p => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
      setMe(pos); setGps({ pos, acc: p.coords.accuracy })
    }, noop, { enableHighAccuracy: true, maximumAge: 1000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [live])

  // 둘러보기에서도 내 위치를 실시간으로: 이미 허용돼 있으면 바로, 아니면 "내 위치" 버튼을 눌렀을 때 켠다
  useEffect(() => {
    let alive = true
    try {
      // 일부 브라우저는 geolocation 조회를 지원하지 않아 바로 예외를 낸다
      navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then(s => { if (alive && s.state === 'granted') setWatchOn(true) }, noop)
    } catch {
      // 권한 조회가 안 되면 버튼을 누를 때까지 기다린다
    }
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!watchOn || live || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      p => { setLocError(null); setGps({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, acc: p.coords.accuracy }) },
      e => { if (e.code === e.PERMISSION_DENIED) { setLocError(window.isSecureContext ? 'denied' : 'https'); setWatchOn(false) } },
      { enableHighAccuracy: true, maximumAge: 1000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [watchOn, live])
  function locate() {
    if (!window.isSecureContext || !navigator.geolocation) { setLocError(window.isSecureContext ? 'denied' : 'https'); return }
    setWatchOn(true)
    setRecenter(n => n + 1)
  }

  // 경로를 40m 넘게 벗어나면 지금 위치에서 다시 찾는다(8초에 한 번까지).
  // 응답을 기다리는 동안 위치가 바뀌어도 결과를 버리지 않는다. 화면을 떠나거나 안내를 끝냈을 때(seq가 바뀜)만 무시한다
  const busy = useRef(false)
  useEffect(() => {
    if (!live || mode !== 'nav' || !route || !me || !dest || busy.current || Date.now() - lastReroute.current < 8000 || !offRoute(route, me)) return
    lastReroute.current = Date.now()
    busy.current = true
    const id = seq.current
    const from = me
    void (async () => {
      setRerouting(true)
      try {
        // 실패하면 옛 경로로 계속 안내하고, 8초 뒤 다시 시도한다
        const r = await fetchRoute(from, dest, lang)
        if (r && id === seq.current) setRoute(r)
      } finally {
        busy.current = false
        if (id === seq.current) setRerouting(false)
      }
    })()
  }, [live, mode, route, me, dest, lang])

  // 주소로 건물을 받으면 바로 경로를 찾는다(시간표·방문객 "자주 찾는 곳"에서 들어올 때)
  const planRef = useRef(plan)
  const pinsRef = useRef(pins)
  useEffect(() => { planRef.current = plan; pinsRef.current = pins })
  useEffect(() => {
    const first = pinsRef.current.find(p => p.id === target)
    if (!first) return
    const timer = setTimeout(() => { setSelected(first.id); void planRef.current(first, autoStart) }, 0)
    return () => clearTimeout(timer)
  }, [target, autoStart])

  // 화면을 떠나면 진행 중인 요청·데모 걷기를 멈춘다
  useEffect(() => cancel, [cancel])

  useEffect(() => {
    if (mode !== 'nav' || !state?.arrived) return
    stop.current()
    stop.current = noop
    const timer = setTimeout(() => setMode('arrived'), 0)
    return () => clearTimeout(timer)
  }, [mode, state?.arrived])

  const next = route && state ? route.steps[state.next] : null
  const fromLabel = start && start.reason !== 'denied' ? t(lang, 'myLocation') : t(lang, 'mainGate')
  const destFacilities = dest ? facilities[dest.id] ?? [] : []

  return (
    <div className="relative h-[calc(100dvh-56px-64px)] overflow-hidden">
      {(() => {
        const view = {
          center, pins, selected, route: route?.coords, follow: mode === 'nav', recenter,
          me: mode === 'browse' ? gps?.pos ?? null : me, accuracy: demo ? undefined : gps?.acc,
          startLabel: fromLabel, endLabel: destLabel || t(lang, 'turn_arrive'),
          onPick: (id: string) => {
            if (mode !== 'browse' && mode !== 'preview') return
            cancel()
            setPlanning(false)
            setSelected(id); setRoute(null); setMode('browse')
          },
        }
        // 카카오 키가 있으면 스카이뷰(한글 지명), 없거나 카카오가 안 뜨면 Esri 위성사진
        return kakaoKey && !kakaoFailed
          ? <KakaoMapView appKey={kakaoKey} onFail={() => setKakaoFailed(true)} {...view} />
          : <MapView {...view} layerLabels={[t(lang, 'satellite'), t(lang, 'tab.map')]} />
      })()}

      {mode === 'browse' && (
        <div className="absolute right-3 top-3 z-[500] flex items-center gap-2">
          {gps && <p role="status" aria-label={t(lang, 'myLocation')} className="rounded-full bg-bg/95 px-3 py-1.5 text-[13px] font-semibold text-ink shadow-[0_4px_12px_-4px_rgba(1,29,72,.3)]"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[#3b82f6]" aria-hidden />{t(lang, 'myLocation')} ±{Math.round(gps.acc)}m</p>}
          <button type="button" onClick={locate} aria-label={t(lang, 'myLocation')} className="press flex h-11 w-11 items-center justify-center rounded-full bg-bg text-[#3b82f6] shadow-[0_4px_12px_-4px_rgba(1,29,72,.35)]"><GpsFix size={22} weight="bold" aria-hidden /></button>
        </div>
      )}
      {mode === 'browse' && locError && (
        <p role="alert" className="absolute left-3 right-3 top-16 z-[500] rounded-2xl bg-ink/90 px-4 py-3 text-[14px] font-medium text-white">{t(lang, locError === 'https' ? 'locationNeedsHttps' : 'locationDenied')}</p>
      )}

      {mode === 'preview' && route && (
        <div className="absolute left-14 right-3 top-3 z-[500] space-y-2 rounded-[20px] bg-bg p-4 text-[15px] shadow-[0_8px_24px_-8px_rgba(1,29,72,.25)]">
          <p className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full bg-navy" aria-hidden />{fromLabel}</p>
          <p className="flex items-center gap-2.5 font-bold"><span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />{destLabel}</p>
        </div>
      )}

      {mode === 'nav' && next && state && (() => {
        const { Icon } = turnInfo(next.turn)
        return (
          <div aria-live="polite" className="absolute left-14 right-3 top-3 z-[500] flex items-center gap-4 rounded-[20px] bg-navy p-4 text-white shadow-[0_8px_24px_-8px_rgba(1,29,72,.5)]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12" aria-hidden><Icon size={32} weight="bold" /></span>
            <div className="min-w-0">
              <p className="text-[28px] font-bold leading-tight tracking-tight">{t(lang, 'inMeters', { m: state.toNext })}</p>
              <p className="truncate text-[15px] text-white/80">{rerouting ? t(lang, 'rerouting') : stepText(next, lang)}</p>
            </div>
          </div>
        )
      })()}

      {mode === 'browse' && dest && (
        <div className="rise absolute inset-x-0 bottom-0 z-[500] flex max-h-[62%] flex-col rounded-t-[28px] bg-bg px-5 pb-6 pt-3 shadow-[0_-8px_24px_-8px_rgba(1,29,72,.2)]">
          <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden />
          <p className="text-[22px] font-bold tracking-tight">{destLabel}</p>
          {/* 건물 안 시설: 이름·위치, 운영시간, 누르면 전화 */}
          {destFacilities.length > 0 && (
            <div className="-mx-5 mt-3 min-h-0 overflow-y-auto px-5">
              <p className="text-[13px] font-semibold text-muted">{t(lang, 'insideBuilding')}</p>
              <ul className="mt-1 divide-y divide-line/70">
                {destFacilities.map((f, i) => {
                  const Icon = KIND_ICON[f.kind] ?? Info
                  return (
                    <li key={`${i}-${f.name}`} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint-text" aria-hidden><Icon size={18} weight="fill" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{f.name}{f.where && <span className="ml-1.5 text-[13px] font-medium text-muted">{f.where}</span>}</span>
                        {f.hours && <span className="block text-[13px] text-teal">{f.hours}</span>}
                      </span>
                      {f.tel && <a href={`tel:${f.tel}`} aria-label={`${f.name} ${f.tel}`} className="press flex h-9 shrink-0 items-center gap-1 rounded-xl bg-bg-soft px-2.5 text-[13px] font-semibold text-ink"><Phone size={15} weight="fill" className="text-teal" aria-hidden />{f.tel.replace(/^033-/, '')}</a>}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-1 text-[12px] text-[#8b93a1]">{t(lang, 'guidebookSource')}</p>
            </div>
          )}
          <button type="button" onClick={() => void plan(dest)} disabled={planning} aria-busy={planning}
            className="press mt-4 flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal text-[17px] font-bold text-white disabled:opacity-60">
            <PersonSimpleWalk size={22} weight="bold" aria-hidden />{t(lang, 'route')}
          </button>
        </div>
      )}

      {mode === 'preview' && route && (
        <div className="rise absolute inset-x-0 bottom-0 z-[500] flex max-h-[58%] flex-col rounded-t-[28px] bg-bg shadow-[0_-8px_24px_-8px_rgba(1,29,72,.2)]">
          <div className="px-5 pb-4 pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
            <p className="flex items-center gap-1 text-[14px] font-semibold text-teal"><PersonSimpleWalk size={18} weight="bold" aria-hidden />{t(lang, 'walk')}</p>
            <p className="mt-1 text-[34px] font-bold leading-tight tracking-tight">{t(lang, 'minutes', { n: mins(route.seconds) })} <span className="text-[17px] font-semibold text-muted">{route.meters}m</span></p>
            {route.source === 'straight' && <p className="mt-1 text-[13px] text-muted">{t(lang, 'straightLine')}</p>}
            {start?.reason === 'denied' && <p className="mt-1 text-[13px] font-medium text-danger">{t(lang, 'startFromGate')}</p>}
            {start?.reason === 'far' && <p className="mt-1 text-[13px] text-muted">{t(lang, 'offCampusStart')}</p>}
            <div className="mt-4 flex gap-2">
              <label className="press flex h-14 items-center gap-2 rounded-2xl bg-bg-soft px-4 text-[14px] font-semibold">
                <input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} className="h-5 w-5 accent-[var(--teal)]" />{t(lang, 'demoMode')}
              </label>
              <button type="button" onClick={startNav} className="press flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-teal text-[17px] font-bold text-white"><Play size={18} weight="fill" aria-hidden />{t(lang, 'startNav')}</button>
            </div>
          </div>
          <ol className="flex-1 overflow-y-auto border-t border-line/70 py-1">
            {route.steps.map((s, i) => {
              const { Icon } = turnInfo(s.turn)
              return (
                <li key={i} className="flex items-center gap-3 px-5 py-3 text-[15px]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy/8 text-navy" aria-hidden><Icon size={20} weight="bold" /></span>
                  <span className="flex-1">{stepText(s, lang)}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {mode === 'nav' && state && route && (
        <div className="absolute inset-x-0 bottom-0 z-[500] flex items-center gap-3 rounded-t-[24px] bg-bg px-5 py-4 shadow-[0_-8px_24px_-8px_rgba(1,29,72,.2)]">
          <div className="flex-1">
            {live && <p className="flex items-center gap-1 text-[12px] font-bold text-teal"><span className="h-2 w-2 animate-pulse rounded-full bg-teal" aria-hidden />{t(lang, 'gpsLive')}</p>}
            <p className="text-[22px] font-bold tracking-tight">{t(lang, 'minutes', { n: mins((state.remaining / Math.max(route.meters, 1)) * route.seconds) })} <span className="text-[15px] font-semibold text-muted">{state.remaining}m</span></p>
          </div>
          <button type="button" onClick={endNav} className="press flex h-12 items-center gap-1.5 rounded-2xl bg-bg-soft px-4 text-[15px] font-bold"><X size={18} weight="bold" aria-hidden />{t(lang, 'endNav')}</button>
        </div>
      )}

      {mode === 'arrived' && (
        <div role="status" className="rise absolute inset-x-0 bottom-0 z-[500] flex flex-col items-center rounded-t-[28px] bg-bg px-6 pb-6 pt-8 text-center shadow-[0_-8px_24px_-8px_rgba(1,29,72,.2)]">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-mint-soft text-teal" aria-hidden><Confetti size={34} weight="fill" /></span>
          <p className="mt-3 text-[24px] font-bold tracking-tight">{t(lang, 'arrived')}</p>
          {room?.roomNo && room.floor != null && <p className="mt-1 text-[17px] font-semibold text-teal">{t(lang, 'floorRoom', { floor: room.floor, room: room.roomNo })}</p>}
          <button type="button" onClick={endNav} className="press mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-navy text-[17px] font-bold text-white">{t(lang, 'confirm')}</button>
        </div>
      )}
    </div>
  )
}

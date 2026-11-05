'use client'
// 휴대폰 방향 센서 구독.
// - 안드로이드 크롬: 권한 없이 값을 주므로 지도에 들어오자마자 auto()로 켠다.
// - 아이폰: 권한을 사용자 동작 안에서만 물을 수 있다. auto()는 이미 허락된 경우 바로 켜고, 아니면 화면 어디든 첫 터치 때 묻는다.
// 첫 값이 늦게 와도(센서 깨우는 데 몇 초 걸리는 휴대폰) 계속 듣고 있다가 값이 오면 바로 켠다
import { useCallback, useEffect, useRef, useState } from 'react'
import { headingFrom, smooth, turnBy } from '@/lib/map/heading'

export type HeadingStatus = 'off' | 'asking' | 'denied-wait' | 'on' | 'denied' | 'unsupported'

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }
const permissionApi = () => (typeof window === 'undefined' ? undefined : (window.DeviceOrientationEvent as unknown as PermissionApi | undefined))
/** 아이폰처럼 사용자가 눌러서 허용해야 하는 브라우저 */
export const headingNeedsTap = () => typeof permissionApi()?.requestPermission === 'function'

/** 첫 값이 이 시간 안에 안 오면 "방향을 알 수 없어요"를 보여 준다(듣기는 계속한다) */
const FIRST_VALUE_MS = 4000
/** 센서는 1초에 수십 번 오므로 화면은 이 간격으로만 다시 그린다 */
const UPDATE_MS = 60

export function useHeading() {
  const [status, setStatus] = useState<HeadingStatus>('off')
  const [heading, setHeading] = useState<number | null>(null)
  /** 센서 이벤트를 듣는 중이면 1 이상(다시 켤 때마다 올려서 첫 값 시간 재기를 새로 한다). 상태가 'unsupported'로 바뀌어도 끊지 않는다 */
  const [listening, setListening] = useState(0)
  const last = useRef<number | null>(null)
  const statusRef = useRef(status)
  /** 권한을 묻는 중(대답을 기다리는 동안 또 묻지 않게) */
  const asking = useRef(false)
  useEffect(() => { statusRef.current = status })

  useEffect(() => {
    if (!listening) return
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
    let got = false
    let pending: ReturnType<typeof setTimeout> | null = null
    // 북쪽 기준 값(absolute)이 오는 이벤트를 먼저 쓰고, 일반 이벤트는 아이폰 나침반 값이나 absolute 표시가 있을 때만 쓴다
    const hasAbsolute = 'ondeviceorientationabsolute' in window
    const onEvent = (ev: Event) => {
      const e = ev as DeviceOrientationEvent & { webkitCompassHeading?: number }
      const absolute = ev.type === 'deviceorientationabsolute' || e.absolute === true
      if (hasAbsolute && ev.type === 'deviceorientation' && typeof e.webkitCompassHeading !== 'number' && !e.absolute) return
      const angle = window.screen?.orientation?.angle ?? 0
      const h = headingFrom({ alpha: e.alpha, absolute, webkitCompassHeading: e.webkitCompassHeading }, angle)
      if (h == null) return
      if (!got) { got = true; setStatus('on') }
      const next = smooth(last.current, h)
      last.current = next
      // 첫 값은 바로, 그다음은 60ms에 한 번 2도 넘게 바뀔 때만 다시 그린다
      if (pending) return
      pending = setTimeout(() => {
        pending = null
        const h = last.current
        if (h != null) setHeading(prev => (prev == null || Math.abs(turnBy(prev, h)) >= 2 ? Math.round(h) : prev))
      }, UPDATE_MS)
    }
    if (hasAbsolute) window.addEventListener('deviceorientationabsolute', onEvent)
    window.addEventListener('deviceorientation', onEvent)
    const timer = setTimeout(() => { if (!got) setStatus(s => (s === 'denied-wait' ? 'denied' : s === 'asking' ? 'unsupported' : s)) }, FIRST_VALUE_MS)
    return () => {
      if (hasAbsolute) window.removeEventListener('deviceorientationabsolute', onEvent)
      window.removeEventListener('deviceorientation', onEvent)
      clearTimeout(timer)
      if (pending) clearTimeout(pending)
    }
  }, [listening])

  /** 버튼 클릭 안에서 부른다(아이폰 권한 창은 사용자 동작 안에서만 뜬다) */
  const start = useCallback(async () => {
    const s = statusRef.current
    // 첫 터치와 버튼 클릭이 한 번에 들어와도 권한은 한 번만 묻는다
    if (s === 'on' || s === 'asking' || s === 'denied-wait' || asking.current) return
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) { setStatus('unsupported'); return }
    const api = permissionApi()
    // 거절돼도 일단 들어 본다(일부 안드로이드 크롬은 묻는 함수가 있어도 값을 그냥 준다)
    let ok = true
    asking.current = true
    try {
      if (typeof api?.requestPermission === 'function') ok = await api.requestPermission().then(r => r === 'granted', () => false)
    } finally {
      asking.current = false
    }
    // 묻는 사이 센서 값이 먼저 와서 켜졌으면 그대로 둔다
    if (statusRef.current === 'on') return
    setStatus(ok ? 'asking' : 'denied-wait')
    setListening(n => n + 1)
  }, [])

  /**
   * 화면에 들어오자마자 부른다. 권한과 상관없이 센서를 조용히 듣기 시작해서(값이 오면 바로 'on', 안 와도 안내 문구는 띄우지 않는다)
   * 묻지 않아도 되는 휴대폰(안드로이드)은 그대로 켜진다. 묻는 함수가 있는 브라우저(아이폰, 최근 크롬)는 이미 허락했으면 바로 켜지고,
   * 아니면 화면 어디든 첫 터치 때 권한을 묻는다. 정리 함수를 돌려준다
   */
  const auto = useCallback(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return () => {}
    if (statusRef.current === 'off') setListening(n => n + 1)
    const api = permissionApi()
    if (typeof api?.requestPermission !== 'function') return () => {}
    let alive = true
    const onTap = () => { off(); if (alive && statusRef.current !== 'on') void start() }
    const off = () => { window.removeEventListener('touchend', onTap, true); window.removeEventListener('click', onTap, true) }
    // 사용자 동작 밖에서 물으면 아직 허락 안 한 사이트는 'denied'나 오류가 온다. 그때는 첫 터치를 기다린다
    const waitTap = () => {
      if (!alive || statusRef.current === 'on') return
      window.addEventListener('touchend', onTap, true)
      window.addEventListener('click', onTap, true)
    }
    api.requestPermission().then(r => { if (alive && r !== 'granted') waitTap() }, waitTap)
    return () => { alive = false; off() }
  }, [start])

  const stop = useCallback(() => { setStatus('off'); setListening(0); setHeading(null); last.current = null }, [])

  return { heading: status === 'on' ? heading : null, status, start, stop, auto }
}

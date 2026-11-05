'use client'
// 휴대폰 방향 센서 구독. 아이폰은 버튼을 누를 때(start) 권한을 물어야 해서, 화면이 버튼 클릭 안에서 start()를 부른다.
// 안드로이드 크롬은 권한 없이 deviceorientationabsolute를 준다. 노트북처럼 센서가 없으면 'unsupported'
import { useCallback, useEffect, useRef, useState } from 'react'
import { headingFrom, smooth, turnBy } from '@/lib/map/heading'

export type HeadingStatus = 'off' | 'asking' | 'denied-wait' | 'on' | 'denied' | 'unsupported'

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }
const permissionApi = () => (typeof window === 'undefined' ? undefined : (window.DeviceOrientationEvent as unknown as PermissionApi | undefined))
/** 아이폰처럼 사용자가 눌러서 허용해야 하는 브라우저 */
export const headingNeedsTap = () => typeof permissionApi()?.requestPermission === 'function'

/** 첫 값이 이 시간 안에 안 오면 센서가 없다고 본다 */
const FIRST_VALUE_MS = 3000
/** 센서는 1초에 수십 번 오므로 화면은 이 간격으로만 다시 그린다 */
const UPDATE_MS = 60

export function useHeading() {
  const [status, setStatus] = useState<HeadingStatus>('off')
  const [heading, setHeading] = useState<number | null>(null)
  const last = useRef<number | null>(null)

  // 'asking' → 'on'으로 바뀔 때 구독을 끊었다 다시 걸지 않게, 켜져 있는지만 본다
  const active = status === 'asking' || status === 'denied-wait' || status === 'on'
  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
    let got = false
    let pending: ReturnType<typeof setTimeout> | null = null
    const absolute = 'ondeviceorientationabsolute' in window
    const type = absolute ? 'deviceorientationabsolute' : 'deviceorientation'
    const onEvent = (ev: Event) => {
      const e = ev as DeviceOrientationEvent & { webkitCompassHeading?: number }
      const angle = window.screen?.orientation?.angle ?? 0
      const h = headingFrom({ alpha: e.alpha, absolute: absolute || e.absolute, webkitCompassHeading: e.webkitCompassHeading }, angle)
      if (h == null) return
      if (!got) { got = true; setStatus('on') }
      const next = smooth(last.current, h)
      last.current = next
      // 화면은 60ms에 한 번, 2도 넘게 바뀔 때만 다시 그린다
      if (pending) return
      pending = setTimeout(() => {
        pending = null
        const h = last.current
        if (h != null) setHeading(prev => (prev == null || Math.abs(turnBy(prev, h)) >= 2 ? Math.round(h) : prev))
      }, UPDATE_MS)
    }
    window.addEventListener(type, onEvent)
    const timer = setTimeout(() => { if (!got) setStatus(s => (s === 'denied-wait' ? 'denied' : 'unsupported')) }, FIRST_VALUE_MS)
    return () => { window.removeEventListener(type, onEvent); clearTimeout(timer); if (pending) clearTimeout(pending) }
  }, [active])

  /** 버튼 클릭 안에서 부른다(아이폰 권한 창은 사용자 동작 안에서만 뜬다) */
  const start = useCallback(async () => {
    if (status === 'on' || status === 'asking' || status === 'denied-wait') return
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) { setStatus('unsupported'); return }
    const api = permissionApi()
    // 거절돼도 일단 들어 본다(일부 안드로이드 크롬은 묻는 함수가 있어도 값을 그냥 준다). 3초 안에 값이 없으면 'unsupported'
    let ok = true
    if (typeof api?.requestPermission === 'function') ok = await api.requestPermission().then(r => r === 'granted', () => false)
    setStatus(ok ? 'asking' : 'denied-wait')
  }, [status])

  const stop = useCallback(() => { setStatus('off'); setHeading(null); last.current = null }, [])

  return { heading: status === 'on' ? heading : null, status, start, stop }
}

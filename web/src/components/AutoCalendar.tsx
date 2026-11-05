'use client'
// "신청 준비해 줘" 직후 한 번만 캘린더 파일을 연다(휴대폰은 캘린더 추가 창이 뜬다). 새로고침해도 다시 열지 않게 주소의 ?new=1을 지운다
import { useEffect } from 'react'

export default function AutoCalendar({ href, taskId }: { href: string; taskId: string }) {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('new') !== '1') return
    url.searchParams.delete('new')
    window.history.replaceState(window.history.state, '', url.pathname + url.search)
    const key = `unimate.cal.${taskId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* 저장소를 못 써도 한 번은 연다 */ }
    window.location.assign(href)
  }, [href, taskId])
  return null
}

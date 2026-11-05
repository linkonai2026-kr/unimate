'use client'
// 목록 끝에 두면 처음 열 때 맨 아래(가장 새 항목)로 내려가고, 이미 아래쪽을 보고 있던 사람에게만 새 항목이 올 때 따라 내려간다
import { useEffect, useRef } from 'react'

/** 이보다 아래에 있었으면 "아래쪽을 보고 있었다"로 본다(px) */
const NEAR = 200

export default function ScrollToEnd({ n }: { n: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  // 바뀌기 직전에 아래쪽에 있었는지는 렌더 뒤에는 알 수 없으므로 스크롤할 때마다 적어 둔다
  const nearBottom = useRef(true)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      nearBottom.current = el.scrollHeight - el.scrollTop - window.innerHeight < NEAR
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    if (first.current) {
      first.current = false
      ref.current.scrollIntoView({ block: 'end' })
      return
    }
    if (nearBottom.current) ref.current.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [n])

  return <div ref={ref} className="scroll-mb-40" aria-hidden />
}

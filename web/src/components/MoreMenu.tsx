'use client'
// "···" 아이콘 하나에 모은 메뉴(글: 수정·삭제·쪽지·신고, 게시판: 삭제). 바깥을 누르거나 Esc를 누르면 닫힌다.
// 한 줄 모양은 ui.tsx의 menuItem(서버 화면에서도 쓰려고 클라이언트 모듈 밖에 둔다). ConfirmButton: 지우기처럼 되돌릴 수 없는 버튼은 한 번 더 묻고 보낸다
import { DotsThree } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'

export function MoreMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current
      if (!d?.open) return
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !d.contains(e.target as Node)) d.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [])
  return (
    <details ref={ref} className="relative shrink-0">
      <summary aria-label={label} className="press flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-muted [&::-webkit-details-marker]:hidden">
        <DotsThree size={26} weight="bold" aria-hidden />
      </summary>
      <div role="menu" aria-label={label} className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-2xl bg-bg py-1 shadow-[0_8px_24px_-8px_rgba(1,29,72,.35)] ring-1 ring-line/60">
        {children}
      </div>
    </details>
  )
}

/** 누르면 confirm 창으로 한 번 더 묻고, 취소하면 폼을 보내지 않는다 */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button role="menuitem" className={className} onClick={e => { if (!window.confirm(message)) e.preventDefault() }}>
      {children}
    </button>
  )
}

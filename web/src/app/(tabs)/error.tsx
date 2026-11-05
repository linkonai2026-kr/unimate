'use client'
// 탭 화면에서 예상치 못한 오류가 나도 앱 틀은 유지하고 다시 시도할 수 있게 한다(retry는 서버 화면을 다시 받아 그린다)
import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import { useEffect } from 'react'

export default function TabsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // 운영에서는 서버 오류 내용 대신 digest만 온다. 서버 로그와 맞춰 볼 수 있게 남긴다
    console.error('[tabs]', error instanceof Error ? (error as Error & { digest?: string }).digest ?? error.message : error)
  }, [error])
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-8 py-20 text-center">
      <WarningCircle size={48} weight="fill" className="text-danger" aria-hidden />
      <p className="text-[18px] font-bold">문제가 생겼어요 · Something went wrong</p>
      <button type="button" onClick={() => retry()} className="press mt-2 flex h-12 items-center gap-2 rounded-2xl bg-navy px-6 text-[16px] font-bold text-white"><ArrowClockwise size={18} weight="bold" aria-hidden />다시 시도 · Retry</button>
    </div>
  )
}

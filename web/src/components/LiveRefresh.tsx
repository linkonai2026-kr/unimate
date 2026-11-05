'use client'
// 서버 컴포넌트 화면에 실시간 갱신을 붙이는 보이지 않는 컴포넌트
import { useLive } from '@/lib/live/useLive'

export default function LiveRefresh({ topics }: { topics: string[] }) {
  useLive(topics)
  return null
}

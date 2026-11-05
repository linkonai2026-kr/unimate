// 지도 탭(시간표에서 ?b=건물&room=호수&go=1로 들어오면 바로 길찾기)
import MapScreen from '@/components/MapScreen'
import { requireUser } from '@/lib/auth/session'
import { has } from '@/lib/env'
import { CAMPUS_CENTER, buildingById, pinsFor } from '@/lib/map/buildings'
import { allFacilities } from '@/lib/map/facilities'

/** "304"·"B101" 같은 호수만 받고, 숫자가 세 자리 이상이면 앞자리를 층으로 */
function roomOf(v: unknown): { roomNo: string | null; floor: number | null } {
  const roomNo = typeof v === 'string' && /^[A-Z]?\d{2,4}$/i.test(v) ? v.toUpperCase() : null
  const digits = roomNo?.replace(/\D/g, '') ?? ''
  const floor = digits.length >= 3 ? Number(digits.slice(0, -2)) : null
  return { roomNo, floor: floor && floor > 0 ? floor : null }
}

export default async function MapPage({ searchParams }: PageProps<'/map'>) {
  const [me, sp] = await Promise.all([requireUser(), searchParams])
  const target = typeof sp.b === 'string' ? buildingById(sp.b)?.id : undefined
  return (
    <MapScreen lang={me.lang} facilities={allFacilities(me.lang)} pins={pinsFor(me.lang)} center={CAMPUS_CENTER} target={target}
      autoStart={sp.go === '1'} kakaoKey={has.kakao ? process.env.KAKAO_MAP_JS_KEY?.trim() : undefined} room={target ? roomOf(sp.room) : undefined} />
  )
}

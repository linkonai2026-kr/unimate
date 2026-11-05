// 방문객 지도: 로그인 없이 건물 27곳·건물 안 시설·도보 길찾기(학생 지도와 같은 화면, 언어는 ?lang=)
import MapScreen from '@/components/MapScreen'
import VisitShell from '@/components/VisitShell'
import { guestLang } from '@/lib/auth/session'
import { has } from '@/lib/env'
import { CAMPUS_CENTER, buildingById, pinsFor } from '@/lib/map/buildings'
import { allFacilities } from '@/lib/map/facilities'

export default async function VisitMap({ searchParams }: PageProps<'/visit/map'>) {
  const sp = await searchParams
  const lang = guestLang(sp.lang)
  const target = typeof sp.b === 'string' ? buildingById(sp.b)?.id : undefined
  return (
    <VisitShell lang={lang} active="map" query={target ? { b: target } : {}}>
      <MapScreen lang={lang} facilities={allFacilities(lang)} pins={pinsFor(lang)} center={CAMPUS_CENTER} target={target}
        autoStart={sp.go === '1'} kakaoKey={has.kakao ? process.env.KAKAO_MAP_JS_KEY?.trim() : undefined} />
    </VisitShell>
  )
}

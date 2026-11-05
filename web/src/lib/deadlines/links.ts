// 신청 도우미의 바로가기 주소: 캘린더 파일, 제출처 길찾기(캠퍼스 지도), 방법 문구 키
import type { Apply } from '../ai'
import type { Lang, UiKey } from '../i18n'
import { buildingById, type Building } from '../map/buildings'
import { parsePlace } from '../timetable/rooms'
import { visitHref } from '../visit'
import { parseDue } from './when'

export const HOW_KEY: Record<Apply['how'], UiKey> = { online: 'howOnline', visit: 'howVisit', email: 'howEmail', other: 'howOther' }

/** 캘린더 파일 주소. 마감을 날짜로 못 읽으면 null(캘린더에 넣을 수 없다) */
export function icsHref(p: { title: string; deadline: string | null; lang: Lang; apply: Apply | null; url: string }): string | null {
  if (!p.deadline || !parseDue(p.deadline)) return null
  const sp = new URLSearchParams({ t: p.title, d: p.deadline, l: p.lang, u: p.url })
  if (p.apply?.where) sp.set('w', p.apply.where)
  for (const k of p.apply?.documents ?? []) sp.append('k', k)
  return `/api/notice/ics?${sp}`
}

/** 제출처 글자에서 캠퍼스 건물과 호수를 찾는다("학생지원과 (대학본부 2층)" → 대학본부) */
export function officeOf(where: string | null | undefined): { building: Building; room: string | null } | null {
  if (!where) return null
  const p = parsePlace(where)
  const building = buildingById(p.buildingId)
  return building ? { building, room: p.roomNo } : null
}

/** 제출처 길찾기 주소(학생 화면은 /map, 방문객 화면은 /visit/map) */
export function officeRouteHref(where: string | null | undefined, mode: 'student' | 'visit', lang: Lang): string | null {
  const o = officeOf(where)
  if (!o) return null
  if (mode === 'visit') return visitHref('/visit/map', lang, { b: o.building.id })
  const q = new URLSearchParams({ b: o.building.id })
  if (o.room) q.set('room', o.room)
  return `/map?${q}`
}

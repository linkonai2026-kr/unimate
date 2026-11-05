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

/**
 * 공지 본문에 실제로 적힌 메일 주소만(지어낸 주소로 보내지 않게). 학교 주소(kangwon.ac.kr)를 앞에, 같은 주소는 한 번
 */
export function noticeEmails(body: string): string[] {
  const found = body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g) ?? []
  const uniq = [...new Set(found.map(e => e.replace(/[.]+$/, '').toLowerCase()))]
  return uniq.sort((a, b) => Number(b.endsWith('kangwon.ac.kr')) - Number(a.endsWith('kangwon.ac.kr'))).slice(0, 5)
}

/** 메일 앱을 제목·본문이 채워진 채로 여는 주소. 받는 사람이 없으면 비워 둔다(메일 앱에서 직접 넣는다) */
export function mailtoHref(to: string, subject: string, body: string): string {
  const addr = /^[^\s@,;?&]+@[^\s@,;?&]+$/.test(to.trim()) ? to.trim() : ''
  // 줄바꿈은 CRLF로(RFC 6068). +는 공백으로 읽는 메일 앱이 있어 %20을 쓰는 encodeURIComponent로
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`
  return `mailto:${addr}?${q}`
}

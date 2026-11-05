// 신청 도우미: 캘린더 파일, 제출처 길찾기, 할 일 저장소, AI 신청 정보 정리
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { tidyApply } from '@/lib/ai/claude'
import { fakeSummary } from '@/lib/ai/fake'
import { buildIcs, fold } from '@/lib/deadlines/ics'
import { icsHref, officeOf, officeRouteHref } from '@/lib/deadlines/links'
import { createMemoryTaskStore, createSupabaseTaskStore, sortTasks, type NewDeadlineTask } from '@/lib/deadlines/store'
import { GET } from '@/app/api/notice/ics/route'

const now = Date.UTC(2026, 10, 6, 3)

describe('buildIcs', () => {
  it('시각이 있는 마감: 30분 일정과 하루 전·3시간 전 알림', () => {
    const ics = buildIcs({ title: '[마감] 장학금, 신청', due: { y: 2026, m: 11, d: 17, h: 18, min: 0 }, alarm: '곧 마감', lines: ['제출처: 학생지원과'], url: 'https://www.kangwon.ac.kr/x', now })
    expect(ics).toContain('DTSTART:20261117T083000Z')
    expect(ics).toContain('DTEND:20261117T090000Z')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics).toContain('TRIGGER:-PT3H')
    expect(ics).toContain('SUMMARY:[마감] 장학금\\, 신청')
    expect(ics.endsWith('\r\n')).toBe(true)
  })
  it('시각이 없으면 종일 일정(다음 날까지), 전날·당일 9시 알림', () => {
    const ics = buildIcs({ title: 'x', due: { y: 2026, m: 12, d: 31, h: null, min: null }, alarm: 'a', lines: [], now })
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231')
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
    expect(ics).toContain('TRIGGER:-PT15H')
    expect(ics).toContain('TRIGGER:PT9H')
  })
  it('긴 한글 줄은 75바이트 안으로 접는다', () => {
    const line = `SUMMARY:${'가'.repeat(60)}`
    const parts = fold(line).split('\r\n ')
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75)
    expect(parts.join('')).toBe(line)
  })
})

describe('/api/notice/ics', () => {
  it('제목·마감이 있으면 캘린더 파일을 내려 준다', async () => {
    const res = GET(new Request('http://x/api/notice/ics?t=%EC%9E%A5%ED%95%99%EA%B8%88&d=11%2F17%2018%3A00&l=en&w=%ED%95%99%EC%83%9D%EC%A7%80%EC%9B%90%EA%B3%BC&k=%EC%8B%A0%EC%B2%AD%EC%84%9C'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    const body = await res.text()
    expect(body).toContain('SUMMARY:[Deadline] 장학금')
    expect(body).toContain('Submit to: 학생지원과')
  })
  it('마감을 못 읽거나 제목이 없으면 400, 위험한 주소는 넣지 않는다', async () => {
    expect(GET(new Request('http://x/api/notice/ics?t=a&d=%EA%B3%A7')).status).toBe(400)
    expect(GET(new Request('http://x/api/notice/ics?d=11%2F17')).status).toBe(400)
    const body = await GET(new Request('http://x/api/notice/ics?t=a&d=11%2F17&u=javascript%3Aalert(1)')).text()
    expect(body).not.toContain('javascript')
  })
})

describe('links', () => {
  it('제출처 글자에서 캠퍼스 건물을 찾아 길찾기 주소를 만든다', () => {
    expect(officeOf('학생지원과 (대학본부 2층)')?.building.id).toBe('hq')
    expect(officeRouteHref('5공학관 405호', 'student', 'ko')).toBe('/map?b=eng5&room=405')
    expect(officeRouteHref('대학본부', 'visit', 'vi')).toBe('/visit/map?b=hq&lang=vi')
    expect(officeRouteHref('학과 사무실', 'student', 'ko')).toBeNull()
  })
  it('마감을 날짜로 못 읽으면 캘린더 주소를 만들지 않는다', () => {
    expect(icsHref({ title: 'a', deadline: '곧', lang: 'ko', apply: null, url: 'https://x' })).toBeNull()
    const href = icsHref({ title: 'a', deadline: '11/17', lang: 'ko', apply: { how: 'visit', where: '대학본부', url: null, documents: ['신청서', '통장 사본'] }, url: 'https://x' })
    expect(href).toContain('/api/notice/ics?')
    expect(new URLSearchParams(href!.split('?')[1]).getAll('k')).toEqual(['신청서', '통장 사본'])
  })
})

describe('tidyApply', () => {
  const body = '신청: https://forms.gle/abc 에서 11/17까지'
  it('본문에 그대로 있는 주소만 남긴다(AI가 지어낸 주소는 버린다)', () => {
    expect(tidyApply({ how: 'online', where: null, url: 'https://forms.gle/abc', documents: [] }, body)?.url).toBe('https://forms.gle/abc')
    expect(tidyApply({ how: 'online', where: null, url: 'https://evil.example/apply', documents: [] }, body)?.url).toBeNull()
    expect(tidyApply({ how: 'online', where: null, url: 'javascript:alert(1)', documents: [] }, 'javascript:alert(1)')?.url).toBeNull()
  })
  it('빈 칸을 지우고 준비물은 8개까지', () => {
    const a = tidyApply({ how: 'visit', where: '  ', url: null, documents: [' a ', '', ...Array(10).fill('b')] }, '')
    expect(a?.where).toBeNull()
    expect(a?.documents).toHaveLength(8)
    expect(a?.documents[0]).toBe('a')
    expect(tidyApply(null, '')).toBeNull()
  })
  it('키가 없을 때 대역 요약도 신청 방법을 짐작한다', () => {
    expect(fakeSummary('t', '신청 https://forms.gle/x 11월 17일').apply).toEqual({ how: 'online', where: null, url: 'https://forms.gle/x', documents: [] })
    expect(fakeSummary('t', '학과 사무실로 방문 제출').apply?.how).toBe('visit')
    expect(fakeSummary('t', '안내드립니다').apply).toBeNull()
  })
})

const task = (over: Partial<NewDeadlineTask> = {}): NewDeadlineTask => ({
  userId: 'u1', board: 'academic', noticeId: '100', title: '장학금', titleKo: '장학금', deadline: '11/17', dueAt: 2, url: 'https://x', apply: null, ...over,
})

describe('task store', () => {
  it('같은 공지를 다시 담으면 하나로 유지하고 체크는 남긴다', async () => {
    const s = createMemoryTaskStore()
    const a = await s.save(task())
    await s.update('u1', a.id, { checked: [0] })
    const b = await s.save(task({ title: '장학금(수정)' }))
    expect(b.id).toBe(a.id)
    const list = await s.list('u1')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ title: '장학금(수정)', checked: [0] })
  })
  it('다른 사람의 할 일은 읽거나 지울 수 없다', async () => {
    const s = createMemoryTaskStore()
    const a = await s.save(task())
    expect(await s.get('u2', a.id)).toBeNull()
    await s.remove('u2', a.id)
    expect(await s.list('u1')).toHaveLength(1)
  })
  it('완료한 것은 뒤로, 마감 가까운 순, 마감을 모르면 그 뒤', () => {
    const base = { userId: 'u', board: 'academic' as const, noticeId: '', title: '', titleKo: '', deadline: null, url: '', apply: null, checked: [], createdAt: 0 }
    const list = sortTasks([
      { ...base, id: 'done', dueAt: 1, done: true },
      { ...base, id: 'none', dueAt: null, done: false },
      { ...base, id: 'late', dueAt: 9, done: false },
      { ...base, id: 'soon', dueAt: 3, done: false },
    ])
    expect(list.map(x => x.id)).toEqual(['soon', 'late', 'none', 'done'])
  })
  it('Supabase에 표가 없으면 메모리로 넘어가 계속 동작한다', async () => {
    const missing = { data: null, error: { code: 'PGRST205', message: 'no table' }, count: null }
    const q: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'limit', 'upsert', 'update', 'delete']) q[k] = () => q
    q.then = (r: (v: unknown) => void) => r(missing)
    const db = { from: () => q } as unknown as Parameters<typeof createSupabaseTaskStore>[0]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = createSupabaseTaskStore(db)
    await s.save(task())
    expect(await s.list('u1')).toHaveLength(1)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

// 사용 통계: 이벤트 검증·자르기, 분위수, 퍼널·걸린 시간 집계, CSV 이스케이프, /stats 열쇠 확인
import { describe, expect, it, vi } from 'vitest'
import {
  MAX_MS, clampMs, cleanMessage, computeStats, createMemoryMetrics, csvCell, eventsCsv, normalizePath, parseBatch, quantile,
  recordsToDb, signupsCsv, statsAllowed, statsRange, toCsv, usersCsv, type EventRow,
} from '@/lib/metrics'

const SID = 'a1b2c3d4-0000-4000-8000-000000000001'

describe('parseBatch', () => {
  it('허용한 종류만 받고 ms는 0~2시간으로 자른다', () => {
    const rows = parseBatch({
      sid: SID,
      events: [
        { kind: 'notice_open', visitor: true, lang: 'en', path: '/visit/notices?lang=en&b=general', board: 'academic', id: '2598', ms: -5 },
        { kind: 'notice_dwell', visitor: true, scope: 'page', ms: 99 * 60 * 60_000 },
        { kind: 'op', op: 'notices', ms: 1, ok: true },
        { kind: 'hack', visitor: true },
        { kind: 'view', visitor: true, nav: 'load', ttfb: 123.6 },
      ],
    }, 1000)!
    expect(rows.map(r => r.kind)).toEqual(['notice_open', 'notice_dwell', 'view'])
    expect(rows[0]).toMatchObject({ at: 1000, sid: SID, uid: null, visitor: true, lang: 'en', path: '/visit/notices', data: { board: 'academic', id: '2598', ms: 0 } })
    expect(rows[1].data.ms).toBe(MAX_MS)
    expect(rows[2].data.ttfb).toBe(124)
  })
  it('세션 id·배열이 틀리면 null, 너무 많은 묶음도 null', () => {
    expect(parseBatch({ sid: 'x', events: [{ kind: 'view', visitor: true, nav: 'load' }] })).toBeNull()
    expect(parseBatch({ sid: SID, events: [] })).toBeNull()
    expect(parseBatch({ sid: SID, events: Array(21).fill({ kind: 'view', visitor: true, nav: 'load' }) })).toBeNull()
    expect(parseBatch('nope')).toBeNull()
  })
  it('브라우저가 보낸 uid는 버리고 서버가 넘긴 uid만 붙인다', () => {
    const [row] = parseBatch({ sid: SID, events: [{ kind: 'view', visitor: false, nav: 'spa', uid: 'evil', spa: 50 }] }, 1, 'user-1')!
    expect(row.uid).toBe('user-1')
    expect(row.data).not.toHaveProperty('uid')
  })
  it('글자 길이·공지 번호 형식·언어를 검사하고, 오류 메시지는 쿼리를 지워 200자로', () => {
    const rows = parseBatch({
      sid: SID,
      events: [
        { kind: 'notice_open', visitor: true, board: 'academic', id: '../x', ms: 1 },
        { kind: 'lang', visitor: true, picked: 'fr' },
        { kind: 'error', visitor: true, type: 'error', message: `boom at https://x.test/a.js?token=secret ${'z'.repeat(400)}` },
      ],
    })!
    expect(rows).toHaveLength(1)
    expect(rows[0].data.message).toMatch(/^boom at https:\/\/x\.test\/a\.js z+$/)
    expect(String(rows[0].data.message)).toHaveLength(200)
  })
  it('clampMs·cleanMessage·normalizePath', () => {
    expect(clampMs(Number.NaN)).toBe(0)
    expect(clampMs(1e12)).toBe(MAX_MS)
    expect(cleanMessage('a\n\nb')).toBe('a b')
    expect(normalizePath('/friends/minjun?x=1')).toBe('/friends/*')
    expect(normalizePath('/visit/notices')).toBe('/visit/notices')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath(undefined)).toBeNull()
  })
})

describe('quantile', () => {
  it('중앙값·p75는 선형 보간(엑셀 PERCENTILE.INC와 같다)', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([4, 1, 3, 2], 0.75)).toBe(3.25)
    expect(quantile([7], 0.75)).toBe(7)
    expect(quantile([], 0.5)).toBeNull()
  })
})

const ev = (sid: string, at: number, kind: EventRow['kind'], o: Partial<EventRow> = {}, data: Record<string, unknown> = {}): EventRow =>
  ({ at, kind, sid, uid: null, visitor: true, lang: 'en', path: '/visit', data, ...o })

describe('computeStats', () => {
  const rows: EventRow[] = [
    // A: 방문 → 언어 → 공지 화면 → 공지 열기
    ev('A', 0, 'view', {}, { nav: 'load', ttfb: 100 }),
    ev('A', 1000, 'lang', {}, { picked: 'vi' }),
    ev('A', 3000, 'view', { path: '/visit/notices', lang: 'vi' }, { nav: 'spa', spa: 200 }),
    ev('A', 9000, 'notice_open', { path: '/visit/notices' }, { board: 'academic', id: '1', ms: 6000, vid: 'v1' }),
    ev('A', 9500, 'notice_dwell', {}, { scope: 'notice', board: 'academic', id: '1', ms: 4000, vid: 'v1' }),
    ev('A', 9600, 'notice_dwell', {}, { scope: 'notice', board: 'academic', id: '1', ms: 2000, vid: 'v1' }),
    // B: 언어를 고르지 않고 바로 공지
    ev('B', 0, 'view', { path: '/visit/notices' }, { nav: 'load', ttfb: 300 }),
    ev('B', 4000, 'notice_open', {}, { board: 'general', id: '2', ms: 2000 }),
    // C: 방문만
    ev('C', 0, 'view', {}, { nav: 'load' }),
    // D: 로그인 사용자
    ev('D', 0, 'view', { visitor: false, uid: 'u1', path: '/notices', lang: 'ko' }, { nav: 'load' }),
    ev('D', 500, 'notice_open', { visitor: false, uid: 'u1' }, { board: 'academic', id: '1', ms: 500 }),
    // 서버 작업
    { at: 1, kind: 'op', sid: null, uid: null, visitor: null, lang: null, path: null, data: { op: 'notices', ms: 100, ok: true, source: 'live' } },
    { at: 2, kind: 'op', sid: null, uid: null, visitor: null, lang: null, path: null, data: { op: 'notices', ms: 300, ok: false, source: 'error' } },
  ]
  const profiles = [
    { id: '9f1c', handle: 'newbie', nickname: '새내기', nationality: 'VN', lang: 'vi', createdAt: Date.parse('2026-11-04T16:30:00Z') },
    { id: 'u-minjun', handle: 'minjun', nickname: '민준', nationality: 'KR', lang: 'ko', createdAt: 0 },
  ]
  const users = [...profiles, { id: 'u1', handle: 'linh', nickname: 'Linh', nationality: 'VN', lang: 'vi', createdAt: 0 }]
  const s = computeStats(rows, profiles, users)

  it('세션·퍼널(단계별·누적)', () => {
    expect(s.sessions).toEqual({ total: 4, visitor: 3, member: 1 })
    expect(s.funnel.map(f => [f.id, f.sessions, f.nested])).toEqual([['visit', 3, 3], ['lang', 1, 1], ['notices', 2, 1], ['open', 2, 1]])
  })
  it('걸린 시간: 첫 공지 열기·공지 화면 도착·같은 화면의 머문 시간 합', () => {
    expect(s.timing.firstOpen).toMatchObject({ n: 3, median: 2000 })
    expect(s.timing.toNotices).toMatchObject({ n: 3, median: 0 })
    expect(s.timing.noticeDwell).toMatchObject({ n: 1, median: 6000 })
    expect(s.pageLoad.visitor.ttfb).toMatchObject({ n: 2, median: 200 })
  })
  it('서버 작업 성공률과 사용자별·가입 집계(데모 계정 제외)', () => {
    expect(s.ops[0]).toMatchObject({ op: 'notices', n: 2, ok: 1, rate: 0.5, median: 200 })
    expect(s.perUser).toEqual([expect.objectContaining({ handle: 'linh', nickname: 'Linh', views: 1, opens: 1, openMedian: 500 })])
    expect(s.signups).toMatchObject({ total: 1, demoExcluded: 1 })
    expect(s.daily.find(d => d.day === '2026-11-05')?.signups).toBe(1)
    expect(s.langs.picked).toEqual({ vi: 1 })
  })
  it('CSV: BOM, 가입 시각은 한국 시간', () => {
    const csv = signupsCsv(s)
    expect(csv.startsWith('﻿"가입 시각(KST)"')).toBe(true)
    expect(csv).toContain('"2026-11-05 01:30","newbie","새내기","VN","vi"')
    expect(usersCsv(s)).toContain('"linh","Linh"')
    expect(eventsCsv(s)).toContain('"[퍼널(방문객)]"')
  })
})

describe('CSV 칸', () => {
  it('따옴표·줄바꿈·수식 시작 글자를 막는다', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('a\r\nb')).toBe('"a b"')
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell('+1')).toBe('"\'+1"')
    expect(csvCell('-1')).toBe('"\'-1"')
    expect(csvCell('@me')).toBe('"\'@me"')
    expect(csvCell(-1)).toBe('"-1"')
    expect(csvCell(null)).toBe('""')
    expect(toCsv([['a', 1]])).toBe('﻿"a","1"\r\n')
  })
})

describe('statsAllowed', () => {
  it('열쇠가 없거나 다르거나 STATS_KEY가 비면 거절', () => {
    expect(statsAllowed(undefined, 'secret')).toBe(false)
    expect(statsAllowed('', 'secret')).toBe(false)
    expect(statsAllowed('wrong', 'secret')).toBe(false)
    expect(statsAllowed(['secret'], 'secret')).toBe(false)
    expect(statsAllowed('secret', '')).toBe(false)
    expect(statsAllowed('secret', undefined)).toBe(false)
    expect(statsAllowed('secret', 'secret')).toBe(true)
  })
})

describe('저장소·기간', () => {
  it('메모리 저장소는 한도를 넘으면 오래된 것부터 버린다', async () => {
    const m = createMemoryMetrics(3)
    await m.add([1, 2, 3, 4].map(at => ev('A', at, 'view')))
    const { rows } = await m.list(0, 10)
    expect(rows.map(r => r.at)).toEqual([2, 3, 4])
  })
  it('기간은 한국 날짜 0시 기준, 기본 최근 30일', () => {
    const r = statsRange('2026-11-01', '2026-11-05')
    expect(r).toEqual({ start: Date.parse('2026-10-31T15:00:00Z'), end: Date.parse('2026-11-05T15:00:00Z') })
    const d = statsRange(null, null, Date.parse('2026-11-05T03:00:00Z'))
    expect(d.end - d.start).toBe(30 * 24 * 60 * 60_000)
  })
})

describe('API', () => {
  const post = (body: string, ip = '10.0.0.1') => new Request('http://x.test/api/events', { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-real-ip': ip } })
  it('/api/events: 맞으면 204, 형식이 틀리면 400, 너무 크면 413', async () => {
    const { POST } = await import('@/app/api/events/route')
    expect((await POST(post(JSON.stringify({ sid: SID, events: [{ kind: 'view', visitor: true, nav: 'load' }] })))).status).toBe(204)
    expect((await POST(post('{bad'))).status).toBe(400)
    expect((await POST(post(JSON.stringify({ sid: 'x', events: [] })))).status).toBe(400)
    expect((await POST(post('x'.repeat(20_000)))).status).toBe(413)
  })
  it('/api/stats/csv: 열쇠가 없거나 다르면 404', async () => {
    const { GET } = await import('@/app/api/stats/csv/route')
    const old = process.env.STATS_KEY
    process.env.STATS_KEY = 'k1'
    try {
      expect((await GET(new Request('http://x.test/api/stats/csv?type=signups'))).status).toBe(404)
      expect((await GET(new Request('http://x.test/api/stats/csv?type=signups&key=nope'))).status).toBe(404)
      const ok = await GET(new Request('http://x.test/api/stats/csv?type=signups&key=k1'))
      expect(ok.status).toBe(200)
      expect(ok.headers.get('content-type')).toContain('text/csv')
      process.env.STATS_KEY = ''
      expect((await GET(new Request('http://x.test/api/stats/csv?type=signups&key='))).status).toBe(404)
    } finally {
      if (old === undefined) delete process.env.STATS_KEY
      else process.env.STATS_KEY = old
    }
  })
})

describe('recordsToDb', () => {
  it('Vercel 운영 배포에서만 DB에 기록한다(로컬·미리보기는 버림)', () => {
    for (const [env, want] of [['production', true], ['preview', false], ['development', false], ['', false]] as const) {
      vi.stubEnv('VERCEL_ENV', env)
      expect(recordsToDb()).toBe(want)
    }
    vi.unstubAllEnvs()
  })
})

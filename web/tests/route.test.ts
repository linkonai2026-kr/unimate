// TMAP 도보 경로 해석, 직선 대역, 출발점 선택 테스트
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTmap, getWalkingRoute, pickStart, navState, offRoute, accuracyRadius, parseLatLng, simulateWalk, straightRoute } from '@/lib/map/route'
import { CAMPUS_CENTER, CAMPUS_GATE } from '@/lib/map/buildings'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/tmap-pedestrian.json', import.meta.url), 'utf8'))
beforeAll(() => { delete process.env.TMAP_APP_KEY })

describe('parseTmap', () => {
  it('LineString 좌표를 순서대로 잇고 경도·위도를 뒤집지 않는다', () => {
    const r = parseTmap(fixture)
    expect(r.coords).toEqual([{ lat: 37.4504, lng: 129.1655 }, { lat: 37.4512, lng: 129.164 }, { lat: 37.4532, lng: 129.1597 }])
    expect(r.meters).toBe(320)
    expect(r.seconds).toBe(260)
  })
  it('Point 지점마다 단계 안내(출발·좌회전·도착)', () => {
    expect(parseTmap(fixture).steps.map(s => [s.turn, s.text])).toEqual([[200, '5공학관 방면으로 출발'], [12, '좌회전 후 160m 이동'], [201, '도착']])
  })
})

describe('getWalkingRoute', () => {
  it('키가 없으면 직선', async () => {
    const r = await getWalkingRoute(CAMPUS_GATE, CAMPUS_CENTER)
    expect(r.source).toBe('straight')
    expect(r.coords).toHaveLength(2)
    expect(r.meters).toBeGreaterThan(0)
    expect(r.steps.map(s => s.turn)).toEqual([200, 201])
  })
})

describe('pickStart', () => {
  it('위치 없음 → 정문, denied', () => expect(pickStart(null)).toEqual({ pos: CAMPUS_GATE, reason: 'denied' }))
  it('캠퍼스에서 멀어도 GPS가 있으면 내 위치에서 출발(far 표시)', () => expect(pickStart({ lat: 37.5665, lng: 126.978 })).toEqual({ pos: { lat: 37.5665, lng: 126.978 }, reason: 'far' }))
  it('캠퍼스 안 → gps', () => expect(pickStart({ lat: 37.4528, lng: 129.1622 })).toEqual({ pos: { lat: 37.4528, lng: 129.1622 }, reason: 'gps' }))
})

describe('navState', () => {
  const route = { ...parseTmap(fixture), source: 'tmap' as const }
  it('출발점에서는 다음 단계가 좌회전, 남은 거리는 전체', () => {
    const s = navState(route, { lat: 37.4504, lng: 129.1655 })
    expect(route.steps[s.next].turn).toBe(12)
    expect(s.remaining).toBeGreaterThan(400)
    expect(s.arrived).toBe(false)
  })
  it('좌회전 지점을 지나면 다음 단계는 도착', () => {
    const s = navState(route, { lat: 37.4518, lng: 129.1627 })
    expect(route.steps[s.next].turn).toBe(201)
    expect(s.toNext).toBeGreaterThan(0)
  })
  it('도착지 30m 안이면 도착', () => {
    expect(navState(route, { lat: 37.4532, lng: 129.1598 }).arrived).toBe(true)
  })
})

describe('offRoute', () => {
  const route = { ...parseTmap(fixture), source: 'tmap' as const }
  it('경로 위(선분 중간)는 이탈 아님', () => expect(offRoute(route, { lat: 37.4508, lng: 129.16475 })).toBe(false))
  it('경로에서 40m 넘게 떨어지면 이탈', () => expect(offRoute(route, { lat: 37.4495, lng: 129.1620 })).toBe(true))
})

describe('GPS 정확도 원 크기', () => {
  it('정확도가 없으면 12m, 너무 작거나 크면 5~150m로 자른다', () => {
    expect(accuracyRadius(undefined)).toBe(12)
    expect(accuracyRadius(0)).toBe(5)
    expect(accuracyRadius(40)).toBe(40)
    expect(accuracyRadius(3000)).toBe(150)
    expect(accuracyRadius(NaN)).toBe(12)
  })
})

describe('좌표 읽기', () => {
  it('"위도,경도" 두 숫자만 받는다', () => {
    expect(parseLatLng('37.4508961,129.1616512')).toEqual({ lat: 37.4508961, lng: 129.1616512 })
    expect(parseLatLng('37.451234567890123,129.16')).toEqual({ lat: 37.451234567890123, lng: 129.16 })
    for (const bad of [',', '', null, 'abc', '37.4,129.1,5', '91,129', '37,181', '1e2,3', ' ,129']) expect(parseLatLng(bad), String(bad)).toBeNull()
  })
})

describe('TMAP 응답이 이상해도 깨지지 않는다', () => {
  it('features가 없거나 좌표가 이상하면 빈 경로', () => {
    expect(parseTmap({}).coords).toEqual([])
    expect(parseTmap({ features: [{ geometry: { type: 'LineString', coordinates: [['x', 1], [129.16]] } }] }).coords).toEqual([])
  })
  it('거리·시간·단계가 없으면 좌표로 채운다', () => {
    const r = parseTmap({ features: [{ geometry: { type: 'LineString', coordinates: [[129.16, 37.45], [129.161, 37.45]] } }] })
    expect(r.meters).toBeGreaterThan(80)
    expect(r.seconds).toBeGreaterThan(0)
    expect(r.steps.map(s => s.turn)).toEqual([200, 201])
  })
})

describe('TMAP 호출', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  it('캠퍼스에서 20km 넘는 출발지는 TMAP을 부르지 않고 직선', async () => {
    vi.stubEnv('TMAP_APP_KEY', 'secret-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await getWalkingRoute({ lat: 37.5665, lng: 126.978 }, CAMPUS_CENTER)).source).toBe('straight')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('TMAP이 실패하면 직선, 요청에는 중단 신호를 붙인다', async () => {
    vi.stubEnv('TMAP_APP_KEY', 'secret-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await getWalkingRoute(CAMPUS_GATE, CAMPUS_CENTER)).source).toBe('straight')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
  it('TMAP이 성공하면 그 경로', async () => {
    vi.stubEnv('TMAP_APP_KEY', 'secret-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)))
    expect((await getWalkingRoute(CAMPUS_GATE, CAMPUS_CENTER)).source).toBe('tmap')
  })
})

describe('안내 계산의 가장자리', () => {
  it('단계가 없는 경로도 숫자가 NaN이 되지 않는다', () => {
    const s = navState({ ...straightRoute(CAMPUS_GATE, CAMPUS_CENTER), steps: [] }, CAMPUS_GATE)
    expect(Number.isNaN(s.toNext)).toBe(false)
    expect(s.remaining).toBeGreaterThan(0)
  })
  it('좌표가 없으면 데모 걷기는 아무것도 하지 않는다', () => {
    const seen: unknown[] = []
    simulateWalk([], p => seen.push(p))()
    expect(seen).toEqual([])
  })
  it('잘못된 GPS 값은 위치 없음으로 본다', () => {
    expect(pickStart({ lat: NaN, lng: 129 }).reason).toBe('denied')
  })
})

describe('/api/route', () => {
  afterEach(() => { vi.doUnmock('server-only'); vi.resetModules() })
  async function handler() {
    vi.doMock('server-only', () => ({}))
    return (await import('@/app/api/route/route')).GET
  }
  it('좌표가 이상하거나 도착지가 캠퍼스 밖이면 400', async () => {
    const GET = await handler()
    expect((await GET(new Request('http://x/api/route?from=,&to=37.453,129.159'))).status).toBe(400)
    expect((await GET(new Request('http://x/api/route?from=37.45,129.16&to=37.5665,126.978'))).status).toBe(400)
  })
  it('캠퍼스 밖 출발(2km 안팎)도 경로를 돌려주고 캐시하지 않는다', async () => {
    const GET = await handler()
    const res = await GET(new Request('http://x/api/route?from=37.44,129.165&to=37.4541807,129.1623334&lang=en'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect((await res.json()).meters).toBeGreaterThan(0)
  })
})

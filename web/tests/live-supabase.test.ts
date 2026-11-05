// Supabase 키가 있으면 실시간 이벤트를 broadcast(REST)로 보낸다
import { describe, it, expect, vi, afterEach } from 'vitest'

// 서버 클라이언트는 globalThis에 캐시되므로 테스트마다 지워 각 테스트의 가짜 클라이언트를 쓰게 한다
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('@supabase/supabase-js'); delete (globalThis as { __unimateRealtime?: unknown }).__unimateRealtime })

describe('publish (Supabase 모드)', () => {
  it('live 채널에 이벤트를 httpSend로 보내고 채널을 정리한다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    const httpSend = vi.fn().mockResolvedValue({ success: true })
    const channel = { httpSend }
    const removeChannel = vi.fn()
    const chan = vi.fn(() => channel)
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ channel: chan, removeChannel }) }))
    const { publish } = await import('@/lib/live/bus')
    await publish({ topic: 'board:free', kind: 'new', id: 'p1' })
    expect(chan).toHaveBeenCalledWith('live')
    expect(httpSend).toHaveBeenCalledWith('e', { topic: 'board:free', kind: 'new', id: 'p1' })
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
  it('broadcast가 실패해도 예외를 내지 않는다(글 저장은 이미 끝남)', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ channel: () => ({ httpSend: vi.fn().mockRejectedValue(new Error('down')) }), removeChannel: vi.fn() }) }))
    const { publish } = await import('@/lib/live/bus')
    await expect(publish({ topic: 'x', kind: 'new', id: '1' })).resolves.toBeUndefined()
  })
  it('채널 정리가 실패해도 예외를 내지 않는다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ channel: () => ({ httpSend: vi.fn().mockResolvedValue({}) }), removeChannel: vi.fn().mockRejectedValue(new Error('x')) }) }))
    const { publish } = await import('@/lib/live/bus')
    await expect(publish({ topic: 'x', kind: 'new', id: '1' })).resolves.toBeUndefined()
  })
  it('Supabase 모드에서도 같은 프로세스의 SSE 구독자에게 낸다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ channel: () => ({ httpSend: vi.fn().mockResolvedValue({}) }), removeChannel: vi.fn() }) }))
    const { publish, subscribe } = await import('@/lib/live/bus')
    const got: string[] = []
    const off = subscribe(['board:sb'], e => got.push(e.id))
    await publish({ topic: 'board:sb', kind: 'new', id: 'p9' })
    off()
    expect(got).toEqual(['p9'])
  })
})

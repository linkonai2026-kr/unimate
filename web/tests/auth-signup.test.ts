// 가입 서버 액션: 프로필에는 비밀번호 해시만 넣는다(평문 password 칸이 Supabase insert에 섞여 배포 사이트 가입이 모두 실패했었다)
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.resetModules(); vi.doUnmock('next/headers'); vi.doUnmock('next/navigation'); vi.doUnmock('@/lib/auth/session'); vi.doUnmock('@/lib/store') })

describe('signup', () => {
  it('createProfile에 평문 password를 넘기지 않고 passHash만 넘긴다', async () => {
    const createProfile = vi.fn(async (p: Record<string, unknown>) => ({ ...p, id: 'u-new' }))
    vi.doMock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '10.0.0.1' }) }))
    vi.doMock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }) }))
    vi.doMock('@/lib/auth/session', () => ({ startSession: vi.fn(async () => {}), endSession: vi.fn(), requireUser: vi.fn() }))
    vi.doMock('@/lib/store', () => ({ getStore: () => ({ getProfileByHandle: async () => null, createProfile }) }))
    const { signup } = await import('@/app/auth-actions')
    const f = new FormData()
    for (const [k, v] of Object.entries({ handle: 'newuser1', password: 'secret-pass-1', nickname: '민', nationality: 'VN', lang: 'vi', uiLang: 'vi' })) f.set(k, v)
    await expect(signup(undefined, f)).rejects.toThrow('REDIRECT')
    const saved = createProfile.mock.calls[0][0]
    expect(saved).not.toHaveProperty('password')
    expect(JSON.stringify(saved)).not.toContain('secret-pass-1')
    expect(saved).toMatchObject({ handle: 'newuser1', nickname: '민', nationality: 'VN', lang: 'vi' })
    expect(String(saved.passHash)).toMatch(/^scrypt\$/)
  })
})

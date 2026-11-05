// 비밀번호 해시, 서명 쿠키 세션(만료 포함), 로그인 시도 제한, 프록시 경로 판단을 검사하는 테스트
import { describe, it, expect } from 'vitest'
import { scryptSync, randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password'
import { signSession, readSession, safeNext, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/token'
import { createLimiter } from '@/lib/rate-limit'
import { createMemoryStore } from '@/lib/store/memory'
import { DEMO_PASSWORD } from '@/lib/store/seed'
import { proxy } from '@/proxy'

describe('password', () => {
  it('맞는 비밀번호만 통과', () => {
    const h = hashPassword('pw-1234')
    expect(h.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('pw-1234', h)).toBe(true)
    expect(verifyPassword('pw-1235', h)).toBe(false)
  })
  it('빈 해시는 항상 실패', () => {
    expect(verifyPassword('x', '')).toBe(false)
  })
  it('망가진 해시(빈 hash·짧은 hex)는 어떤 비밀번호도 통과시키지 않는다', () => {
    expect(verifyPassword('', 'abc:zz')).toBe(false)
    expect(verifyPassword('anything', 'abcd:')).toBe(false)
    expect(verifyPassword('anything', `${'a'.repeat(32)}:ab`)).toBe(false)
  })
  it('과하게 큰 비용이 적힌 해시는 계산하지 않고 거부', () => {
    expect(verifyPassword('x', `scrypt$${2 ** 22}$8$1$${'a'.repeat(32)}$${'b'.repeat(64)}`)).toBe(false)
  })
  it('예전 형식(salt:hash, Node 기본 비용) 해시도 통과하고, 다시 해시가 필요하다고 알려 준다', () => {
    const salt = randomBytes(16).toString('hex')
    const legacy = `${salt}:${scryptSync('old-pass-1', salt, 32).toString('hex')}`
    expect(verifyPassword('old-pass-1', legacy)).toBe(true)
    expect(verifyPassword('old-pass-2', legacy)).toBe(false)
    expect(needsRehash(legacy)).toBe(true)
    expect(needsRehash(hashPassword('x'))).toBe(false)
  })
  it('같은 글자를 다른 유니코드 조합으로 써도 통과(NFC)', () => {
    const h = hashPassword('한글비번1234')
    expect(verifyPassword('한글비번1234'.normalize('NFD'), h)).toBe(true)
  })
})

describe('session token', () => {
  it('서명한 토큰은 다시 읽힌다', () => {
    expect(readSession(signSession('u1'))).toBe('u1')
  })
  it('서명이 바뀌면 거부', () => {
    const tok = signSession('u1')
    const bad = tok.slice(0, -1) + (tok.endsWith('a') ? 'b' : 'a')
    expect(readSession(bad)).toBeNull()
  })
  it('서명 없는 평문·예전 형식(id.서명)은 거부', () => {
    expect(readSession('u1')).toBeNull()
    expect(readSession(undefined)).toBeNull()
    const [id, , sig] = signSession('u1').split('.')
    expect(readSession(`${id}.${sig}`)).toBeNull()
  })
  it('발급 시각을 바꾸면 서명이 맞지 않아 거부', () => {
    const [id, , sig] = signSession('u1').split('.')
    expect(readSession(`${id}.${Math.floor(Date.now() / 1000 + 9e6).toString(36)}.${sig}`)).toBeNull()
  })
  it('만료 기간이 지나면 거부, 그 전에는 통과', () => {
    const t0 = Date.UTC(2026, 0, 1)
    const tok = signSession('u1', t0)
    expect(readSession(tok, t0 + (SESSION_MAX_AGE - 60) * 1000)).toBe('u1')
    expect(readSession(tok, t0 + (SESSION_MAX_AGE + 60) * 1000)).toBeNull()
  })
  it('먼 미래에 발급된 토큰은 거부', () => {
    const t0 = Date.UTC(2026, 0, 1)
    expect(readSession(signSession('u1', t0 + 60 * 60_000), t0)).toBeNull()
  })
  it('id에 점·이상한 문자가 있으면 서명하지 않는다', () => {
    expect(() => signSession('a.b')).toThrow()
    expect(() => signSession('')).toThrow()
  })
})

describe('safeNext', () => {
  it('같은 사이트 상대 경로만 받는다', () => {
    expect(safeNext('/friends/add?h=minjun')).toBe('/friends/add?h=minjun')
    expect(safeNext('/')).toBe('/')
  })
  it('다른 사이트로 가는 주소·로그인 화면 자신은 거부', () => {
    for (const v of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', '/a\nb', '/\tx', '', '/login', '/signup?x=1', 42, undefined, ['/me']])
      expect(safeNext(v), String(v)).toBeNull()
  })
  it('점 경로로 바깥을 가리켜도 같은 사이트 안으로 정리된다', () => {
    expect(safeNext('/a/../../me')).toBe('/me')
  })
})

describe('createLimiter', () => {
  it('blocked는 횟수를 쓰지 않고 이미 다 썼는지만 본다', () => {
    const fails = createLimiter({ limit: 2, windowMs: 1000 })
    expect(fails.blocked('a', 0)).toBe(false)
    fails('a', 1); fails('a', 2)
    expect(fails.blocked('a', 3)).toBe(true)
    expect(fails.blocked('a', 1001)).toBe(false)
  })
  it('키가 넘쳐도 다른 키들의 제한이 통째로 풀리지 않는다', () => {
    const allow = createLimiter({ limit: 1, windowMs: 10_000, maxKeys: 3 })
    expect(allow('victim', 0)).toBe(true)
    expect(allow('victim', 1)).toBe(false)
    // 지난 창 키부터 지우므로, 창이 끝나기 전에는 가장 오래된 것만 밀려난다
    allow('x1', 2); allow('x2', 3)
    expect(allow('x3', 4)).toBe(true)
    expect(allow('x3', 5)).toBe(false)
    expect(allow('x2', 6)).toBe(false)
  })
})

describe('proxy', () => {
  const req = (path: string, token?: string) =>
    new NextRequest(`http://localhost${path}`, token ? { headers: { cookie: `${SESSION_COOKIE}=${token}` } } : undefined)
  const redirected = (path: string, token?: string) => {
    const loc = proxy(req(path, token)).headers.get('location')
    return loc ? new URL(loc).pathname === '/login' : false
  }

  it('로그인·가입·방문객 화면과 공개 파일은 그냥 통과', () => {
    for (const p of ['/login', '/signup', '/visit', '/visit/map', '/brand/logo.png', '/flags/kr.svg', '/manifest.webmanifest', '/icon.png'])
      expect(redirected(p), p).toBe(false)
  })
  it('이름만 비슷한 경로·점이 들어간 경로는 로그인이 필요하다', () => {
    for (const p of ['/', '/loginx', '/visitor', '/signups', '/friends/a.b', '/me.json', '/brand/../me'])
      expect(redirected(p), p).toBe(true)
  })
  it('로그인으로 보낼 때 원래 주소를 next로 넘긴다(첫 화면은 생략)', () => {
    const loc = (p: string) => new URL(proxy(req(p)).headers.get('location')!)
    expect(loc('/friends/add?h=minjun').searchParams.get('next')).toBe('/friends/add?h=minjun')
    expect(loc('/').searchParams.has('next')).toBe(false)
  })
  it('유효한 세션이면 통과, 위조·만료 쿠키는 지우고 로그인으로', () => {
    expect(redirected('/me', signSession('u1'))).toBe(false)
    const res = proxy(req('/me', 'u1.abc.def'))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`)
  })
})

describe('demo accounts', () => {
  it('시드 데모 계정은 DEMO_PASSWORD로 로그인된다', async () => {
    const p = await createMemoryStore(true).getProfileByHandle('linh')
    expect(verifyPassword(DEMO_PASSWORD, p!.passHash)).toBe(true)
  })
})

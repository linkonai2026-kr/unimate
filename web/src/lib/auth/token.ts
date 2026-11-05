// 사용자 id와 발급 시각에 HMAC 서명을 붙인 세션 토큰(SESSION_MAX_AGE가 지나면 만료). 프록시와 서버가 함께 쓴다
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'uni_s'
/** 세션 유효 기간(초): 쿠키 maxAge와 토큰 만료에 함께 쓴다 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
/** 서버 사이 시계 차이로 "미래에 발급된" 토큰을 이만큼은 받아 준다 */
const CLOCK_SKEW_MS = 5 * 60_000
const ID = /^[A-Za-z0-9_-]{1,64}$/
const IAT = /^[0-9a-z]{1,10}$/

const secret = () => {
  const v = process.env.SESSION_SECRET?.trim()
  if (v) return v
  // 운영에서 비밀값이 없으면 저장소에 공개된 기본값으로 서명하게 되므로 막는다
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production')
  return 'unimate-dev-secret'
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

/** 형식: <사용자 id>.<발급 시각(초, 36진수)>.<서명> */
export function signSession(userId: string, now = Date.now()): string {
  if (!ID.test(userId)) throw new Error('signSession: invalid user id')
  const payload = `${userId}.${Math.floor(now / 1000).toString(36)}`
  return `${payload}.${sign(payload)}`
}

/**
 * 로그인 뒤 돌아갈 주소(?next=)를 같은 사이트 안의 상대 경로로만 받는다(열린 리디렉션 막기).
 * "//evil.com", "/\evil.com", 제어 문자, 로그인·가입 화면 자신은 거부 → null
 */
export function safeNext(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 512 || !v.startsWith('/') || v.startsWith('//')) return null
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return null
  const base = 'http://unimate.invalid'
  let url: URL
  try { url = new URL(v, base) } catch { return null }
  if (url.origin !== base || /^\/(?:login|signup)(?:\/|$)/.test(url.pathname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** 서명이 맞고 만료되지 않은 토큰이면 사용자 id, 아니면 null(예전 형식 토큰도 null) */
export function readSession(token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 200) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [id, iat, sig] = parts
  if (!ID.test(id) || !IAT.test(iat)) return null
  const want = Buffer.from(sign(`${id}.${iat}`)), got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  const issued = parseInt(iat, 36) * 1000
  if (issued > now + CLOCK_SKEW_MS || now - issued > SESSION_MAX_AGE * 1000) return null
  return id
}

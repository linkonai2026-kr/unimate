// scrypt로 비밀번호를 해시하고 검증(매개변수를 해시 안에 적어 두어 나중에 올려도 옛 해시가 그대로 통한다)
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

/** 지금 새로 만드는 해시의 비용. N=2^15·r=8이면 해시 한 번에 메모리 32MB */
const COST = { N: 2 ** 15, r: 8, p: 1 }
/** 처음 형식("salt:hash")이 쓰던 Node 기본값 */
const LEGACY = { N: 2 ** 14, r: 8, p: 1 }
const KEYLEN = 32
const MAXMEM = 96 * 1024 * 1024

type Parsed = { N: number; r: number; p: number; salt: string; hash: Buffer; legacy: boolean }

export const isValidPassword = (pw: string) => pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX

const derive = (pw: string, salt: string, { N, r, p }: { N: number; r: number; p: number }) =>
  scryptSync(pw.normalize('NFC'), salt, KEYLEN, { N, r, p, maxmem: MAXMEM })

/** 형식: scrypt$N$r$p$salt$hash (salt·hash는 hex) */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt}$${derive(pw, salt, COST).toString('hex')}`
}

function parse(stored: string): Parsed | null {
  const legacy = /^([0-9a-f]{32}):([0-9a-f]{64})$/.exec(stored)
  if (legacy) return { ...LEGACY, salt: legacy[1], hash: Buffer.from(legacy[2], 'hex'), legacy: true }
  const m = /^scrypt\$(\d{1,7})\$(\d{1,2})\$(\d)\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(stored)
  if (!m) return null
  const [N, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])]
  // 저장값이 망가졌거나 조작돼도 서버가 멈출 만큼 큰 비용은 돌리지 않는다
  const sane = N >= 2 ** 14 && N <= 2 ** 17 && (N & (N - 1)) === 0 && r >= 1 && r <= 16 && p >= 1 && p <= 4 && 128 * N * r <= MAXMEM
  return sane ? { N, r, p, salt: m[4], hash: Buffer.from(m[5], 'hex'), legacy: false } : null
}

/** 처음 형식(NFC 정규화 전)으로 만든 해시: 그때와 같은 입력으로 계산한다 */
const deriveLegacy = (pw: string, salt: string) => scryptSync(pw, salt, KEYLEN, { ...LEGACY, maxmem: MAXMEM })

export function verifyPassword(pw: string, stored: string): boolean {
  const s = typeof stored === 'string' ? parse(stored) : null
  if (!s || typeof pw !== 'string' || pw.length > 4 * PASSWORD_MAX) return false
  const got = s.legacy ? deriveLegacy(pw, s.salt) : derive(pw, s.salt, s)
  return got.length === s.hash.length && timingSafeEqual(got, s.hash)
}

/** 옛 형식이거나 지금보다 낮은 비용의 해시면 true(로그인에 성공했을 때 다시 해시해 저장) */
export function needsRehash(stored: string): boolean {
  const s = parse(stored)
  return !s || s.legacy || s.N < COST.N || s.r < COST.r || s.p < COST.p
}

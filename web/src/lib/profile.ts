// 프로필 수정 입력 정리와 비밀번호 변경 규칙
import { isValidPassword, verifyPassword } from './auth/password'
import { isLang } from './i18n'
import { isNation } from './nations'
import type { Profile } from './types'

type Patch = Partial<Pick<Profile, 'nickname' | 'lang' | 'nationality' | 'avatar' | 'major' | 'year'>>

export const NICKNAME_MAX = 20
const MAJOR_MAX = 30
const YEAR_MAX = 10
const AVATARS = 8

/** 문자열이면 제어 문자(줄바꿈·탭 등)를 공백으로, 공백을 하나로 줄이고 앞뒤를 자른다. 문자열이 아니면 undefined */
export function cleanText(v: unknown): string | undefined {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim() : undefined
}
/** 글자(코드 포인트) 단위로 자른다(이모지가 반쪽으로 깨지지 않게) */
const cut = (s: string, max: number) => (s.length <= max ? s : [...s].slice(0, max).join(''))

/**
 * 폼 값에서 허용된 칸만 남긴다. 잘못된 값은 버리고(기존 값 유지),
 * 학과·학번은 칸이 비어서 오면 지운다('').
 */
/** 시드 데모 계정(id가 u-로 시작). 발표·체험용이라 국적·사용 언어를 바꿀 수 없다 */
export const isDemoAccount = (p: { id: string }) => p.id.startsWith('u-')

export function cleanProfilePatch(raw: Record<string, unknown>): Patch {
  const out: Patch = {}
  const nick = cleanText(raw.nickname)
  if (nick && nick.length <= NICKNAME_MAX) out.nickname = nick
  const avatar = typeof raw.avatar === 'number' ? raw.avatar : typeof raw.avatar === 'string' && raw.avatar.trim() ? Number(raw.avatar) : NaN
  if (Number.isInteger(avatar) && avatar >= 0 && avatar < AVATARS) out.avatar = avatar
  const major = cleanText(raw.major)
  if (major !== undefined) out.major = cut(major, MAJOR_MAX)
  const year = cleanText(raw.year)
  if (year !== undefined) out.year = cut(year, YEAR_MAX)
  if (isLang(raw.lang)) out.lang = raw.lang
  if (isNation(raw.nationality)) out.nationality = raw.nationality
  return out
}

/** 현재 비밀번호가 틀리면 'wrong', 새 비밀번호가 규칙(8~128자)에 맞지 않으면 'short' */
export function checkPasswordChange(current: string, next: string, hash: string): 'ok' | 'wrong' | 'short' {
  if (!verifyPassword(current, hash)) return 'wrong'
  return isValidPassword(next) ? 'ok' : 'short'
}

'use server'
// 가입·로그인·로그아웃·내 정보 변경 서버 액션(입력은 zod로 검사, 로그인·가입 시도는 횟수 제한)
import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { hashPassword, needsRehash, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from '@/lib/auth/password'
import { endSession, requireUser, startSession } from '@/lib/auth/session'
import { safeNext } from '@/lib/auth/token'
import { isLang, t, type Lang, type UiKey } from '@/lib/i18n'
import { MAX_IMAGE_BYTES, sniffImage } from '@/lib/images'
import { NATIONS } from '@/lib/nations'
import { checkPasswordChange, cleanProfilePatch, cleanText, isDemoAccount, NICKNAME_MAX } from '@/lib/profile'
import { createLimiter } from '@/lib/rate-limit'
import { getStore } from '@/lib/store'

/** 실패하면 오류 문구와, 폼이 비워져도 다시 채울 입력값(비밀번호 제외) */
export type FormState = { error?: string; values?: Record<string, string> } | undefined
export type PasswordState = { error?: string; ok?: boolean } | undefined

const WINDOW = 15 * 60_000
/** 아이디별 로그인 실패(비밀번호 맞히기 막기). 성공한 로그인은 세지 않는다 */
const loginFailsByHandle = createLimiter({ limit: 10, windowMs: WINDOW, maxKeys: 20_000 })
/** IP별 로그인 실패(여러 아이디를 돌아가며 맞히기 막기) */
const loginFailsByIp = createLimiter({ limit: 50, windowMs: WINDOW, maxKeys: 20_000 })
/** IP별 가입 */
const signupsByIp = createLimiter({ limit: 30, windowMs: 60 * 60_000 })
/** 사용자별 현재 비밀번호 틀림(빼앗긴 세션으로 비밀번호 맞히기 막기) */
const passwordFails = createLimiter({ limit: 5, windowMs: WINDOW })

const text = (f: FormData, k: string) => {
  const v = f.get(k)
  return typeof v === 'string' ? v : ''
}
const langOf = (v: unknown): Lang => (isLang(v) ? v : 'ko')
const fail = (lang: Lang, key: UiKey, values?: Record<string, string>): FormState => ({ error: t(lang, key), values })

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'local'
}

/** 없는 아이디도 있는 아이디와 같은 시간이 걸리게 검증할 가짜 해시 */
let dummyHash: string | undefined
const dummy = () => (dummyHash ??= hashPassword(randomUUID()))

const loginSchema = z.object({
  handle: z.string().min(1).max(40),
  password: z.string().min(1).max(4 * PASSWORD_MAX),
})

export async function login(_: FormState, f: FormData): Promise<FormState> {
  const lang = langOf(f.get('uiLang'))
  const handle = text(f, 'handle').trim().toLowerCase()
  const values = { handle: handle.slice(0, 40) }
  const input = loginSchema.safeParse({ handle, password: text(f, 'password') })
  if (!input.success) return fail(lang, 'loginFailed', values)

  const ip = await clientIp()
  if (loginFailsByHandle.blocked(handle) || loginFailsByIp.blocked(ip)) return fail(lang, 'tooManyAttempts', values)

  const store = getStore()
  const user = await store.getProfileByHandle(input.data.handle)
  const ok = verifyPassword(input.data.password, user?.passHash ?? dummy())
  if (!user || !ok) {
    loginFailsByHandle(handle)
    loginFailsByIp(ip)
    return fail(lang, 'loginFailed', values)
  }
  // 옛 형식·낮은 비용의 해시는 맞는 비밀번호를 받은 김에 새 해시로 바꿔 둔다
  if (needsRehash(user.passHash)) await store.updateProfile(user.id, { passHash: hashPassword(input.data.password) })
  await startSession(user.id)
  redirect(safeNext(f.get('next')) ?? '/')
}

const signupSchema = z.object({
  handle: z.string().regex(/^[a-z0-9]{3,20}$/),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  nickname: z.string().min(1).max(NICKNAME_MAX),
  nationality: z.enum(NATIONS),
})

export async function signup(_: FormState, f: FormData): Promise<FormState> {
  // 오류는 지금 보고 있는 화면 언어로, 가입 정보의 언어는 고른 사용 언어로
  const uiLang = langOf(f.get('uiLang') ?? f.get('lang'))
  const lang = langOf(f.get('lang'))
  const raw = {
    handle: text(f, 'handle').trim().toLowerCase(),
    password: text(f, 'password'),
    nickname: cleanText(f.get('nickname')) ?? '',
    nationality: text(f, 'nationality').trim(),
  }
  const values = { handle: raw.handle.slice(0, 20), nickname: raw.nickname.slice(0, NICKNAME_MAX), nationality: raw.nationality, lang }
  if (!raw.handle || !raw.password || !raw.nickname || !raw.nationality) return fail(uiLang, 'required', values)
  const input = signupSchema.safeParse(raw)
  if (!input.success) {
    const field = input.error.issues[0]?.path[0]
    return fail(uiLang, field === 'handle' ? 'handleRule' : field === 'password' ? 'passwordRule' : 'required', values)
  }
  if (!signupsByIp(await clientIp())) return fail(uiLang, 'tooManyAttempts', values)

  const store = getStore()
  if (await store.getProfileByHandle(input.data.handle)) return fail(uiLang, 'handleTaken', values)
  let userId: string
  try {
    // 평문 비밀번호는 프로필에 넣지 않는다(Supabase profiles에는 password 칸이 없어 가입이 통째로 실패했다). 해시만 저장
    const { password, ...profile } = input.data
    userId = (await store.createProfile({ ...profile, lang, passHash: hashPassword(password) })).id
  } catch (e) {
    // 같은 아이디로 동시에 가입하면 한쪽은 unique 제약에 걸린다
    if (await store.getProfileByHandle(input.data.handle)) return fail(uiLang, 'handleTaken', values)
    throw e
  }
  await startSession(userId)
  redirect(safeNext(f.get('next')) ?? '/')
}

export async function logout() {
  await endSession()
  redirect('/login')
}

export async function updateMe(f: FormData) {
  const me = await requireUser()
  const store = getStore()
  const patch: Parameters<typeof store.updateProfile>[1] = cleanProfilePatch(Object.fromEntries(f))
  // 데모 계정은 국적·사용 언어가 고정이다(폼을 고쳐 보내도 무시)
  if (isDemoAccount(me)) { delete patch.lang; delete patch.nationality }
  // 프로필 사진: 앞 바이트로 형식을 확인한 것만 받는다. 지우기를 누르면 기본 그림으로
  const file = f.get('photo')
  if (f.get('removePhoto') === 'on') patch.photo = null
  else if (file instanceof File && file.size > 0 && file.size <= MAX_IMAGE_BYTES) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImage(bytes)
    if (type) patch.photo = await store.saveImage(bytes, type, me.id)
  }
  await store.updateProfile(me.id, patch)
  redirect('/me')
}

export async function changePassword(_: PasswordState, f: FormData): Promise<PasswordState> {
  const me = await requireUser()
  if (passwordFails.blocked(me.id)) return { error: t(me.lang, 'tooManyAttempts') }
  const next = text(f, 'next')
  const r = checkPasswordChange(text(f, 'current'), next, me.passHash)
  if (r === 'wrong') {
    passwordFails(me.id)
    return { error: t(me.lang, 'wrongPassword') }
  }
  if (r === 'short') return { error: t(me.lang, 'passwordRule') }
  await getStore().updateProfile(me.id, { passHash: hashPassword(next) })
  return { ok: true }
}

// 요청 쿠키에서 현재 사용자를 읽고(요청마다 한 번), 세션 쿠키를 만들고 지우고, 로그인 전 화면 언어를 정한다
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { isLang, type Lang } from '../i18n'
import { getStore } from '../store'
import type { Profile } from '../types'
import { readSession, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from './token'

export { SESSION_COOKIE }

/** 레이아웃과 페이지가 함께 불러도 한 렌더에서 한 번만 읽는다 */
export const currentUser = cache(async (): Promise<Profile | null> => {
  const id = readSession((await cookies()).get(SESSION_COOKIE)?.value)
  return id ? getStore().getProfile(id) : null
})

export async function requireUser(): Promise<Profile> {
  const me = await currentUser()
  if (!me) redirect('/login')
  return me
}

export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE, secure: process.env.NODE_ENV === 'production',
  })
}

export async function endSession() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/' })
}

/** 로그인 전 화면 언어: ?lang= 값, 없으면 한국어 */
export const guestLang = (v: unknown): Lang => (isLang(v) ? v : 'ko')

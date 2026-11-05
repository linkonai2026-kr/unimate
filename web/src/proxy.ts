// 로그인하지 않은 요청을 로그인 화면으로 보낸다(돌아올 주소는 ?next=). 로그인·가입·방문객 모드 /visit과 공개 파일은 로그인 없이 연다
import { NextResponse, type NextRequest } from 'next/server'
import { readSession, safeNext, SESSION_COOKIE } from './lib/auth/token'

/** 로그인 없이 여는 화면: 정확히 그 경로이거나 그 아래만(/loginx 같은 경로는 막는다) */
const PUBLIC_PAGE = /^\/(?:login|signup|visit)(?:\/|$)/
/** public/ 폴더 파일과 Next가 만드는 아이콘·매니페스트 */
const PUBLIC_FILE = /^\/(?:(?:brand|flags)\/[\w.-]+\.(?:png|svg)|favicon\.ico|icon\.png|apple-icon\.png|manifest\.webmanifest|robots\.txt)$/

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PAGE.test(pathname) || PUBLIC_FILE.test(pathname)) return NextResponse.next()
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (readSession(token)) return NextResponse.next()
  // 로그인한 뒤 원래 보려던 화면(예: 친구 QR로 연 /friends/add?h=…)으로 돌아가게 ?next=에 담는다
  const login = new URL('/login', req.url)
  const next = safeNext(`${pathname}${req.nextUrl.search}`)
  if (next && next !== '/') login.searchParams.set('next', next)
  const res = NextResponse.redirect(login)
  // 만료·위조된 쿠키는 지워서 매번 다시 검사하지 않게
  if (token) res.cookies.delete(SESSION_COOKIE)
  return res
}

export const config = {
  // API는 각 핸들러가 직접 로그인을 확인한다(401). Next 내부 파일은 건너뛴다
  matcher: ['/((?!api/|_next/|__nextjs).*)'],
}

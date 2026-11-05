// 익명 사용 통계 받기(로그인 없이 공개): 크기·형식·IP당 횟수를 검사하고 204. 로그인한 사용자면 서버가 세션 쿠키로 계정 id를 붙인다. IP는 횟수 제한 키로만 쓰고 저장하지 않는다
import { cookies } from 'next/headers'
import { readSession, SESSION_COOKIE } from '@/lib/auth/token'
import { MAX_BODY, parseBatch, saveLater } from '@/lib/metrics'
import { createLimiter } from '@/lib/rate-limit'

/** IP당 1분에 60번(한 번에 이벤트 20개까지) */
const allowed = createLimiter({ limit: 60, windowMs: 60_000 })

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  return (req.headers.get('x-forwarded-for') ?? '').split(',').map(s => s.trim()).filter(Boolean).at(-1) ?? 'unknown'
}

async function userId(): Promise<string | null> {
  try {
    return readSession((await cookies()).get(SESSION_COOKIE)?.value)
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return empty(413)
    if (!allowed(clientIp(req))) return empty(429)
    const text = await req.text()
    if (text.length > MAX_BODY) return empty(413)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return empty(400)
    }
    const rows = parseBatch(body, Date.now(), await userId())
    if (!rows) return empty(400)
    saveLater(rows)
    return empty(204)
  } catch {
    // 통계 오류는 응답만 버린다
    return empty(204)
  }
}

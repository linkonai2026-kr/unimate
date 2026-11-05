// 두 좌표 사이 도보 경로(TMAP, 없으면 직선)와 단계 안내를 사용자 언어로 돌려주는 API(도착지는 캠퍼스 근처만, 방문객은 IP·학생은 계정 단위 횟수 제한)
import { translateList } from '@/lib/ai'
import { currentUser } from '@/lib/auth/session'
import { has } from '@/lib/env'
import { isLang } from '@/lib/i18n'
import { DEST_RADIUS_M, getWalkingRoute, nearCampus, parseLatLng, TMAP_START_RADIUS_M } from '@/lib/map/route'
import { recordServer } from '@/lib/metrics'
import { createLimiter } from '@/lib/rate-limit'

/** 로그인 없는 방문객 길찾기: IP당 10분에 30회. 학생은 계정당 10분에 120회(안내 중 경로 다시 찾기를 넉넉히). TMAP·번역 사용량 보호 */
const visitorAllowed = createLimiter({ limit: 30, windowMs: 10 * 60_000 })
const studentAllowed = createLimiter({ limit: 120, windowMs: 10 * 60_000 })

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } })

/** 요청한 사람의 IP. 플랫폼이 넣는 x-real-ip를 먼저, 없으면 x-forwarded-for의 마지막(가장 가까운 프록시가 붙인) 값 */
function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const chain = (req.headers.get('x-forwarded-for') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return chain.at(-1) ?? 'unknown'
}

/** 로그인한 학생 id(세션을 못 읽으면 방문객으로 본다) */
async function studentId(): Promise<string | null> {
  try {
    return (await currentUser())?.id ?? null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const from = parseLatLng(sp.get('from')), to = parseLatLng(sp.get('to'))
  if (!from || !to) return json({ error: 'bad coords' }, 400)
  if (!nearCampus(to, DEST_RADIUS_M)) return json({ error: 'destination out of campus' }, 400)
  const uid = await studentId()
  if (!(uid ? studentAllowed(uid) : visitorAllowed(clientIp(req)))) return json({ error: 'too many requests' }, 429, { 'Retry-After': '600' })

  const t0 = Date.now()
  try {
    const route = await getWalkingRoute(from, to)
    const lang = sp.get('lang')
    if (isLang(lang) && lang !== 'ko' && route.steps.some(s => s.text)) {
      const texts = await translateList(route.steps.map(s => s.text), lang).catch(() => [] as string[])
      route.steps = route.steps.map((s, i) => ({ ...s, text: typeof texts[i] === 'string' && texts[i] ? texts[i] : s.text }))
    }
    // TMAP을 쓸 수 있는 요청인데 직선이면 TMAP이 실패한 것
    recordServer('route', { ms: Date.now() - t0, ok: route.source === 'tmap' || !has.tmap || !nearCampus(from, TMAP_START_RADIUS_M), source: route.source })
    return json(route)
  } catch (e) {
    recordServer('route', { ms: Date.now() - t0, ok: false, source: 'error' })
    console.warn('[api/route]', e instanceof Error ? e.message : e)
    return json({ error: 'route failed' }, 502)
  }
}

// 시간표 캡처 이미지를 받아 강의 목록으로 인식해 돌려주는 API(로그인 필요, 사용자당 횟수 제한)
import { parseTimetable } from '@/lib/ai'
import { currentUser } from '@/lib/auth/session'
import { sniffImage } from '@/lib/images'
import { createLimiter } from '@/lib/rate-limit'
import { normalizeParsed } from '@/lib/timetable/slots'

const MAX_BYTES = 5 * 1024 * 1024
/** 폼 경계·필드 이름 몫 여유 */
const MAX_BODY = MAX_BYTES + 64 * 1024
/** 인식 결과에서 받을 최대 강의 수 */
const MAX_COURSES = 60

/** AI 사용량 보호: 사용자당 10분에 10회 */
const allowed = createLimiter({ limit: 10, windowMs: 10 * 60_000 })

const fail = (error: string, status: number) => Response.json({ error }, { status })

export async function POST(req: Request) {
  const me = await currentUser()
  if (!me) return fail('unauthorized', 401)
  // 본문을 다 읽기 전에 크기부터 거른다
  const length = Number(req.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_BODY) return fail('too large', 413)
  if (!allowed(me.id)) return fail('too many requests', 429)

  let file: FormDataEntryValue | null
  try {
    file = (await req.formData()).get('image')
  } catch {
    return fail('bad form', 400)
  }
  if (!(file instanceof File) || file.size === 0) return fail('no image', 400)
  if (file.size > MAX_BYTES) return fail('too large', 413)
  // 브라우저가 붙인 형식은 믿지 않고 파일 앞 바이트로 판별한다
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mediaType = sniffImage(bytes)
  if (!mediaType) return fail('bad image', 415)

  try {
    const parsed = await parseTimetable({ data: Buffer.from(bytes).toString('base64'), mediaType })
    return Response.json(normalizeParsed(Array.isArray(parsed) ? parsed.slice(0, MAX_COURSES) : []))
  } catch (e) {
    console.warn('[timetable/parse]', e instanceof Error ? e.message : e)
    return fail('parse failed', 502)
  }
}

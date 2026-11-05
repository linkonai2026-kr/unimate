// 게시판·프로필 사진을 내려주는 API(로그인한 사용자만, 저장된 바이트를 다시 확인한 형식으로만)
import { currentUser } from '@/lib/auth/session'
import { sniffImage } from '@/lib/images'
import { getStore } from '@/lib/store'

/** 스토어가 만드는 id 모양(uuid)만 받는다 */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(_: Request, ctx: RouteContext<'/api/img/[id]'>) {
  if (!(await currentUser())) return new Response('unauthorized', { status: 401, headers: NO_STORE })
  const { id } = await ctx.params
  const img = ID.test(id) ? await getStore().getImage(id) : null
  // 저장할 때 판별한 형식과 지금 바이트가 다르면(망가진 행) 내보내지 않는다
  if (!img || sniffImage(img.data) !== img.type) return new Response('not found', { status: 404, headers: NO_STORE })
  return new Response(Buffer.from(img.data), {
    headers: {
      'Content-Type': img.type,
      'Content-Length': String(img.data.byteLength),
      // 같은 id의 사진은 바뀌지 않는다. 로그인한 사람만 보므로 공유 캐시에는 두지 않는다
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  })
}

// 실시간 이벤트를 브라우저로 흘려보내는 SSE 엔드포인트(로그인한 사용자만, 허용된 토픽만)
import { currentUser } from '@/lib/auth/session'
import { MAX_TOPICS, canSubscribe, subscribe } from '@/lib/live/bus'

export const dynamic = 'force-dynamic'

const PING_MS = 25_000

export async function GET(req: Request) {
  const me = await currentUser()
  if (!me) return new Response('Unauthorized', { status: 401 })
  // 토픽마다 ?t= 하나(과목명처럼 쉼표가 든 토픽도 깨지지 않게)
  const topics = [...new Set(new URL(req.url).searchParams.getAll('t'))].filter(t => canSubscribe(t, me.id)).slice(0, MAX_TOPICS)
  if (topics.length === 0) return new Response('No topics', { status: 400 })

  const enc = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      // 연결이 이미 끊긴 요청이면 구독·타이머를 만들지 않는다
      if (req.signal.aborted) {
        ctrl.close()
        return
      }
      let closed = false
      const send = (s: string) => {
        if (closed) return
        try { ctrl.enqueue(enc.encode(s)) } catch { cleanup() }
      }
      const off = subscribe(topics, e => send(`data: ${JSON.stringify(e)}\n\n`))
      const ping = setInterval(() => send(': ping\n\n'), PING_MS)
      const onAbort = () => {
        cleanup()
        try { ctrl.close() } catch { /* 이미 닫힘 */ }
      }
      // 끊김(abort)·취소(cancel)·쓰기 실패 어느 쪽이 먼저 와도 구독과 타이머를 한 번만 정리한다
      cleanup = () => {
        if (closed) return
        closed = true
        off()
        clearInterval(ping)
        req.signal.removeEventListener('abort', onAbort)
      }
      req.signal.addEventListener('abort', onAbort)
      send('retry: 5000\n: open\n\n')
    },
    cancel() { cleanup() },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

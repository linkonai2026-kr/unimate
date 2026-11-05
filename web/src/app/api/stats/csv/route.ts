// 발표 자료용 CSV 내려받기(?type=events|users|signups&key=…&from=&to=): STATS_KEY가 비었거나 맞지 않으면 404
import { eventsCsv, kstDate, loadStats, signupsCsv, statsAllowed, statsRange, usersCsv } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

const MAKE = { events: eventsCsv, users: usersCsv, signups: signupsCsv } as const

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  if (!statsAllowed(sp.get('key'))) return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const type = sp.get('type') ?? 'events'
  if (!(type in MAKE)) return new Response('bad type', { status: 400 })
  const range = statsRange(sp.get('from'), sp.get('to'))
  const { stats } = await loadStats(range)
  const name = `unimate-${type}-${kstDate(range.start)}_${kstDate(range.end - 1)}.csv`
  return new Response(MAKE[type as keyof typeof MAKE](stats), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

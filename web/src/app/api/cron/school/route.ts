// 공지·학식 번역 미리 만들기(Vercel 크론): job=notices는 매일 새벽, job=menu는 월요일 새벽.
// CRON_SECRET이 있으면 그 값(Authorization: Bearer)으로만 강제로 다시 만들고, 없거나 틀리면 "오늘(이번 주) 저장본이 없을 때만" 만든다
// → 아무나 불러도 하루(한 주)에 한 번 넘게 AI 비용이 들지 않는다
import { getCacheStore } from '@/lib/school/cache-store'
import { kstDay } from '@/lib/school/memo'
import { buildMenu, buildNotices, menuKey, noticeKey, weekKey, type MenuDict, type NoticeSnap } from '@/lib/school/prebuilt'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const LOCK_MS = 10 * 60_000

export async function GET(req: Request) {
  const job = new URL(req.url).searchParams.get('job')
  if (job !== 'notices' && job !== 'menu') return Response.json({ error: 'job must be notices or menu' }, { status: 400 })
  const secret = process.env.CRON_SECRET?.trim()
  const forced = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  const store = getCacheStore()
  const now = Date.now()

  if (!forced) {
    const fresh = job === 'notices'
      ? (await store.get<NoticeSnap>(noticeKey('general', 'en')))?.day === kstDay(now).iso && (await store.get<NoticeSnap>(noticeKey('academic', 'en')))?.day === kstDay(now).iso
      : (await store.get<MenuDict>(menuKey('en')))?.weekKey === weekKey(now)
    if (fresh) return Response.json({ job, skipped: 'already built' })
  }

  const jobs = job === 'menu' ? ['menu'] : ['notices-academic', 'notices-general']
  const result: Record<string, string> = {}
  for (const j of jobs) {
    if (!(await store.claim(j, LOCK_MS))) { result[j] = 'busy'; continue }
    const t0 = Date.now()
    try {
      if (j === 'menu') result[j] = (await buildMenu(store, now)) ? 'ok' : 'menu unavailable'
      else {
        const snaps = await buildNotices(j === 'notices-academic' ? 'academic' : 'general', store, now)
        result[j] = `ok, missing ${Object.values(snaps).reduce((s, x) => s + x.missing, 0)}`
      }
      result[j] += ` (${Date.now() - t0}ms)`
    } catch (e) {
      result[j] = `failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200)
    } finally {
      await store.release(j).catch(() => {})
    }
  }
  return Response.json({ job, forced, result })
}

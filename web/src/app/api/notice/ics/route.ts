// 공지 마감 캘린더 파일(.ics): 휴대폰에서 누르면 기본 캘린더에 마감 일정과 알림(하루 전·당일)이 들어간다. 로그인 없이도 쓴다
import { isLang, t, type Lang } from '@/lib/i18n'
import { buildIcs } from '@/lib/deadlines/ics'
import { parseDue } from '@/lib/deadlines/when'
import { safeHttpUrl } from '@/lib/school/notices'

const text = (v: string | null, max: number) => (v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const title = text(sp.get('t'), 200)
  const due = parseDue(text(sp.get('d'), 60))
  if (!title || !due) return new Response('bad request', { status: 400 })
  const l = sp.get('l')
  const lang: Lang = isLang(l) ? l : 'ko'
  const where = text(sp.get('w'), 80)
  const docs = sp.getAll('k').map(k => text(k, 80)).filter(Boolean).slice(0, 8)
  const raw = text(sp.get('u'), 500)
  const url = raw ? safeHttpUrl(raw) : null
  const lines = [
    ...(where ? [`${t(lang, 'submitTo')}: ${where}`] : []),
    ...(docs.length ? [`${t(lang, 'toPrepare')}: ${docs.join(', ')}`] : []),
  ]
  const body = buildIcs({ title: `[${t(lang, 'deadline')}] ${title}`, due, alarm: t(lang, 'calendarAlarm', { title }), lines, url })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="deadline.ics"',
      'Cache-Control': 'no-store',
    },
  })
}

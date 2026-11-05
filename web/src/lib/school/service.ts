// 공지·식단을 화면에 주는 서버 도우미(한국 날짜 기준, 실패해도 화면에 예외를 올리지 않는다).
// 번역·요약은 사용자 요청 때 만들지 않는다: 공지는 하루 한 번, 메뉴 이름 번역은 한 주에 한 번 미리 만든 저장본을 읽는다(prebuilt.ts)
import 'server-only'
import type { Apply } from '../ai'
import { recordServer } from '../metrics'
import type { Lang } from '../i18n'
import { getMenu, menuTargetDay, type MenuWeek } from './menu'
import { createMemo } from './memo'
import { postedToday, snapshotNotices, type Notice, type NoticeBoard } from './notices'
import { menuNames, menuTranslations, readNotices, weekKey } from './prebuilt'

/** isToday: 오늘(한국) 올라온 글, dday: 마감까지 "D-3"(한국 날짜 기준, 지났거나 모르면 null) */
/** apply: AI가 뽑은 신청 방법(제출처·신청 주소·준비 서류), 없으면 null */
export type NoticeCard = Notice & { titleTr: string; excerpt: string; images: number; files: string[]; bullets: string[]; deadline: string | null; isToday: boolean; dday: string | null; apply: Apply | null }

const bare = (n: Notice): NoticeCard => ({ ...n, titleTr: n.title, excerpt: '', images: 0, files: [], bullets: [], deadline: null, isToday: postedToday(n.date), dday: null, apply: null })

/** 공지 카드: 미리 만든 저장본(사용자 언어)을 읽는다. 저장본도 학교 사이트도 안 되면 저장해 둔 스냅샷 원문 */
export async function noticeCards(board: NoticeBoard, lang: Lang, limit = 3): Promise<{ items: NoticeCard[]; source: 'live' | 'snapshot' }> {
  const t0 = Date.now()
  try {
    const { items, source, status } = await readNotices(board, lang, limit)
    recordServer('notices', { ms: Date.now() - t0, ok: source === 'live', source: status })
    return { items, source }
  } catch (e) {
    console.warn('[noticeCards]', board, e instanceof Error ? e.message : e)
    recordServer('notices', { ms: Date.now() - t0, ok: false, source: 'error' })
    return { items: snapshotNotices(board, limit).map(bare), source: 'snapshot' }
  }
}

export type MenuView = MenuWeek & { tr: Record<string, string> }
/** live: 방금 학교 사이트에서 받음, cached: 사이트가 응답하지 않아 같은 주에 마지막으로 받은 식단(at: 받은 시각) */
export type MenuResultView = { week: MenuView; source: 'live' } | { week: MenuView; source: 'cached'; at: number } | { week: null; source: 'error' }

// 식단 받기는 2분 동안 같이 쓴다(학교가 주중에 메뉴를 바꿔도 곧 반영되고, 화면마다 학교 사이트를 기다리지 않게)
const g = globalThis as { __uniMenuMemo?: ReturnType<typeof createMemo> }
const menuMemo = (g.__uniMenuMemo ??= createMemo(2 * 60_000))

// 마지막으로 받은 식단(같은 주일 때만 쓴다: 지난주 식단은 보여 주지 않는다). 서버가 재시작하면 사라진다
const lastMenu = globalThis as { __uniLastMenu?: { week: MenuWeek; weekKey: string; at: number } }

/**
 * 이번 주 식단. 식단 자체는 학교 사이트에서 새로 받고(2분 공유), 메뉴 이름 번역은 한 주에 한 번 만든 사전에서 찾기만 한다
 * (사전에 없는 새 이름은 원문 그대로, 뒤에서 새 이름만 번역). 사이트가 응답하지 않으면 같은 주에 마지막으로 받은 식단, 그것도 없으면 error
 */
export async function menuView(lang: Lang, now = Date.now()): Promise<MenuResultView> {
  const t0 = Date.now()
  const r = await menuMemo(`menu-fetch:${menuTargetDay(now).iso}`, () => getMenu(undefined, now), x => !!x.week).catch(() => ({ week: null, source: 'error' as const }))
  let week: MenuWeek
  let at: number | null = null
  if (r.week) {
    week = r.week
    lastMenu.__uniLastMenu = { week, weekKey: weekKey(now), at: now }
  } else {
    const saved = lastMenu.__uniLastMenu
    if (!saved || saved.weekKey !== weekKey(now)) {
      recordServer('menu', { ms: Date.now() - t0, ok: false, source: 'error' })
      return { week: null, source: 'error' }
    }
    week = saved.week
    at = saved.at
  }
  const { tr, status } = await menuTranslations(lang, menuNames(week), now)
  recordServer('menu', { ms: Date.now() - t0, ok: at == null, source: at == null ? `live-${status}` : 'cached' })
  return at == null ? { week: { ...week, tr }, source: 'live' } : { week: { ...week, tr }, source: 'cached', at }
}

// 강원대 홈페이지에서 삼척캠퍼스 학사·일반 공지를 읽어 오는 파서와 fetch(실패 시 스냅샷)
import * as cheerio from 'cheerio'
import { dDayOf } from '../deadlines/when'
import { fetchHtml, kstDay, type Fetcher, type KstDay } from './memo'
import snapshot from './snapshot/notices.json'

export type NoticeBoard = 'academic' | 'general'
export interface Notice { id: string; board: NoticeBoard; title: string; dept: string; date: string; url: string }

const BASE = 'https://www.kangwon.ac.kr'
const BBS: Record<NoticeBoard, number> = { academic: 720, general: 504 }
export const listUrl = (b: NoticeBoard) => `${BASE}/ko/bbs/${BBS[b]}/list.do?searchMulti=4`
export const detailUrl = (b: NoticeBoard, id: string) => `${BASE}/ko/bbs/${BBS[b]}/detail.do?pstSn=${encodeURIComponent(id)}`

/** 글 번호는 숫자만(외부 HTML 값을 주소에 넣기 전에 확인) */
const isId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,12}$/.test(v)

/** 화면에 링크로 걸어도 되는 주소인지(http·https만) */
export function safeHttpUrl(v: string): string | null {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/** "2026.10.30"·"2026-10-30"·"2026. 10. 30."·"10월 30일"(올해)을 [년, 월, 일]로. 못 읽으면 null */
function parseDay(s: string, today: KstDay): [number, number, number] | null {
  const full = /(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/.exec(s)
  if (full) return [Number(full[1]), Number(full[2]), Number(full[3])]
  const ko = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(s)
  return ko ? [today.y, Number(ko[1]), Number(ko[2])] : null
}

/** 오늘(한국 시간) 올라온 공지인지 */
export function postedToday(date: string, now: Date | number = Date.now()): boolean {
  const today = kstDay(now)
  const p = parseDay(date, today)
  return !!p && p[0] === today.y && p[1] === today.m && p[2] === today.d
}

/** 마감까지 남은 날 표시(한국 날짜 기준): "D-3", 오늘이면 "D-day", 지났거나 못 읽으면 null */
// AI가 주는 "11/17 18:00" 형식과 기간("11/10~11/17")도 읽도록 마감 전용 해석기를 쓴다
export const dDay = (deadline: string, now: Date | number = Date.now()): string | null => dDayOf(deadline, now)

export function parseNoticeList(html: string, board: NoticeBoard): Notice[] {
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const out: Notice[] = []
  $('tr').each((_, tr) => {
    const row = $(tr)
    const a = row.find('a.detail-button[data-sn]').first()
    const id = a.attr('data-sn')?.trim()
    if (!isId(id) || seen.has(id) || row.find('[aria-label="삼척"]').length === 0) return
    const title = clean(a.text())
    if (!title) return
    const tds = row.children('td')
    const titleIdx = tds.index(a.closest('td'))
    const cell = (k: number) => (titleIdx < 0 ? '' : clean(tds.eq(titleIdx + k).text()))
    seen.add(id)
    out.push({ id, board, title, dept: cell(1), date: cell(2), url: detailUrl(board, id) })
  })
  return out
}

export interface NoticeDetail { text: string; images: number; files: string[] }

/** 상세 페이지의 실제 정보: 본문 글자, 본문 이미지 수, 첨부 파일 이름(AI 없이 그대로 보여 준다) */
export function parseNoticeDetail(html: string): NoticeDetail {
  if (!html) return { text: '', images: 0, files: [] }
  const $ = cheerio.load(html)
  $('.material-symbols-outlined, .material-icons, .blind, script, style').remove()
  const area = $('.editor-wrap').first()
  return {
    text: clean(area.text()),
    images: area.find('img').length,
    files: [...new Set($('.view-file-item a').map((_, el) => clean($(el).text())).get().filter(Boolean))],
  }
}

/** AI 요약 입력용 본문. 이미지·첨부만 있는 공지가 많아서 이미지 설명과 첨부 파일 이름도 붙인다 */
export function parseNoticeBody(html: string): string {
  if (!html) return ''
  const $ = cheerio.load(html)
  const d = parseNoticeDetail(html)
  const alts = $('.editor-wrap').first().find('img[alt]').map((_, el) => clean($(el).attr('alt') ?? '')).get().filter(Boolean)
  return [d.text, alts.length ? `[이미지] ${alts.join(', ')}` : '', d.files.length ? `[첨부] ${d.files.join(', ')}` : ''].filter(Boolean).join('\n')
}

/** 저장해 둔 공지(사이트가 안 될 때) */
export const snapshotNotices = (board: NoticeBoard, limit: number) => (snapshot as Notice[]).filter(n => n.board === board).slice(0, limit)

export async function getNotices(board: NoticeBoard, limit = 5, get: Fetcher = fetchHtml): Promise<{ items: Notice[]; source: 'live' | 'snapshot' }> {
  const n = Math.max(0, Math.floor(limit))
  try {
    const items = parseNoticeList(await get(listUrl(board)), board)
    if (items.length > 0) return { items: items.slice(0, n), source: 'live' }
  } catch (e) {
    console.warn('[getNotices]', board, e instanceof Error ? e.message : e)
  }
  return { items: snapshotNotices(board, n), source: 'snapshot' }
}

/** 상세 HTML. 실패하면 빈 문자열(캐시하지 않도록 호출 쪽이 빈 값을 걸러 낸다) */
export async function getNoticeHtml(board: NoticeBoard, id: string, get: Fetcher = fetchHtml): Promise<string> {
  if (!isId(id)) return ''
  try {
    return await get(detailUrl(board, id))
  } catch (e) {
    console.warn('[getNoticeHtml]', board, id, e instanceof Error ? e.message : e)
    return ''
  }
}

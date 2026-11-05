// AI 기능의 진입점: 데모 사전 번역 → Claude(시간 제한·중단·동시 실행 제한) → 대역 순으로 처리. 글 검수도 같은 줄을 쓴다
import { has } from '../env'
import type { Lang } from '../i18n'
import { recordServer, timed } from '../metrics'
import type { ModerationInput, Verdict } from '../moderation'
import type { TrMap } from '../types'
import { claudeList, claudeMail, claudeModerate, claudeSummary, claudeTimetable, claudeTranslate } from './claude'
import { SAMPLE_TIMETABLE, demoTranslate, fakeMail, fakeModerate, fakeSummary, fakeTranslate } from './fake'

export interface ParsedCourse { name: string; place: string; day: number; start: string; end: string }
/**
 * 공지에서 뽑은 신청 방법. how: 온라인 신청·방문 제출·이메일·기타, where: 제출처(부서·건물·호실을 적힌 대로),
 * url: 본문에 그대로 적힌 신청 주소만, documents: 준비할 서류·준비물
 */
export interface Apply { how: 'online' | 'visit' | 'email' | 'other'; where: string | null; url: string | null; documents: string[] }
export interface Summary { bullets: string[]; deadline: string | null; apply?: Apply | null }
/** 신청 메일 초안 재료: 공지(제목·본문·마감·신청 방법)와 학생이 확인한 이름·학과·학번 */
export interface MailInput {
  notice: { title: string; body: string; deadline: string | null; apply: Apply | null }
  student: { name: string; major: string; studentId: string }
}
/** 담당 부서에 보낼 한국어 메일과, 학생이 읽을 자기 언어 번역 */
export interface MailDraft { subject: string; body: string; subjectTr: string; bodyTr: string }
type ImageInput = { data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }

const TRANSLATE_MS = 25_000, SUMMARY_MS = 20_000, LIST_MS = 20_000, TIMETABLE_MS = 12_000, MODERATE_MS = 15_000, MAIL_MS = 25_000

/** 시간이 지나면 요청 자체를 끊는다(응답만 버리고 호출은 계속 도는 일이 없게) */
async function abortAfter<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error(`claude: timed out after ${ms}ms`)), ms)
  try {
    return await run(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** 실패·시간 초과면 대역 값 */
async function orFallback<T>(label: 'summary' | 'list' | 'timetable' | 'mail', ms: number, run: (signal: AbortSignal) => Promise<T>, fallback: () => T): Promise<T> {
  const t0 = Date.now()
  try {
    const v = await abortAfter(ms, run)
    recordServer(`ai_${label}`, { ms: Date.now() - t0, ok: true, source: 'claude' })
    return v
  } catch (e) {
    recordServer(`ai_${label}`, { ms: Date.now() - t0, ok: false, source: 'fallback' })
    console.warn(`[ai] ${label} fallback:`, e instanceof Error ? e.message : e)
    return fallback()
  }
}

/**
 * 응답 뒤 번역이 한꺼번에 몰려도 Claude 호출은 동시에 몇 개만, 기다리는 줄도 길이를 제한한다
 * (줄이 넘치면 그 번역은 포기하고 원문을 둔다)
 */
const MAX_ACTIVE = 4, MAX_WAITING = 100
let active = 0
const waiting: (() => void)[] = []
async function acquire() {
  if (active < MAX_ACTIVE) { active++; return }
  if (waiting.length >= MAX_WAITING) throw new Error('claude: translate queue full')
  await new Promise<void>(resolve => waiting.push(resolve))
}
function release() {
  const next = waiting.shift()
  if (next) next() // 자리를 그대로 넘긴다(active 유지)
  else active--
}

/**
 * context: 앞선 대화(원글·앞 댓글·최근 쪽지). Claude만 쓰고 데모 사전·대역은 무시.
 * 키가 있을 때 실패하면 가짜 번역을 저장하지 않도록 예외를 그대로 올린다(호출 쪽이 원문 유지)
 */
export async function translate(fields: Record<string, string>, context: string[] = []): Promise<{ detected: Lang; tr: TrMap }> {
  const demo = demoTranslate(fields)
  if (demo) return demo
  if (!has.ai) return fakeTranslate(fields)
  await acquire()
  try {
    return await timed('ai_translate', abortAfter(TRANSLATE_MS, signal => claudeTranslate(fields, context, signal)))
  } finally {
    release()
  }
}

/**
 * 글·댓글 검수. 키가 없으면 낱말 목록 대역, 있으면 Claude(번역과 같은 동시 실행 줄).
 * 실패·시간 초과·줄이 넘치면 null: 확실하지 않을 때는 제재하지 않는다
 */
export async function moderate(input: ModerationInput): Promise<Verdict | null> {
  if (!has.ai) return fakeModerate(input)
  try {
    await acquire()
  } catch (e) {
    console.warn('[ai] moderate skipped:', e instanceof Error ? e.message : e)
    return null
  }
  try {
    return await abortAfter(MODERATE_MS, signal => claudeModerate(input, signal))
  } catch (e) {
    console.warn('[ai] moderate failed:', e instanceof Error ? e.message : e)
    return null
  } finally {
    release()
  }
}

export async function summarizeNotice(title: string, body: string, lang: Lang): Promise<Summary> {
  if (!has.ai) return fakeSummary(title, body)
  // 키가 있는데 실패하면 대역(본문 첫 문장·첫 날짜)을 내지 않고 예외를 올린다. 대역의 마감은 성적 송부일 같은 엉뚱한 날짜일 수 있고,
  // 호출 쪽은 예외면 캐시하지 않고 요약 없이 본문 앞부분만 보여 준다(다음 요청에서 다시 시도)
  try {
    return await abortAfter(SUMMARY_MS, signal => claudeSummary(title, body, lang, signal))
  } catch (e) {
    console.warn('[ai] summary failed:', e instanceof Error ? e.message : e)
    throw e
  }
}

/** 실패하면 원문(한국어) 목록을 그대로 돌려준다 */
export async function translateList(items: string[], lang: Lang): Promise<string[]> {
  if (!has.ai || lang === 'ko' || items.length === 0) return items
  return orFallback('list', LIST_MS, signal => claudeList(items, lang, signal), () => items)
}

/** 신청 메일 초안. 키가 없거나 실패하면 정해진 틀로 쓴 초안(학생 언어 번역 포함) */
export async function draftApplyMail(input: MailInput, lang: Lang): Promise<MailDraft> {
  if (!has.ai) return fakeMail(input, lang)
  return orFallback('mail', MAIL_MS, signal => claudeMail(input, lang, signal), () => fakeMail(input, lang))
}

export async function parseTimetable(image: ImageInput): Promise<ParsedCourse[]> {
  if (!has.ai) return SAMPLE_TIMETABLE
  return orFallback('timetable', TIMETABLE_MS, signal => claudeTimetable(image, undefined, signal), () => [])
}

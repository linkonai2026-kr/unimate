// AI 기능의 진입점: 데모 사전 번역 → Claude(시간 제한·중단·동시 실행 제한) → 대역 순으로 처리
import { has } from '../env'
import type { Lang } from '../i18n'
import type { TrMap } from '../types'
import { claudeList, claudeSummary, claudeTimetable, claudeTranslate } from './claude'
import { SAMPLE_TIMETABLE, demoTranslate, fakeSummary, fakeTranslate } from './fake'

export interface ParsedCourse { name: string; place: string; day: number; start: string; end: string }
export interface Summary { bullets: string[]; deadline: string | null }
type ImageInput = { data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }

const TRANSLATE_MS = 25_000, SUMMARY_MS = 12_000, LIST_MS = 8_000, TIMETABLE_MS = 12_000

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
async function orFallback<T>(label: string, ms: number, run: (signal: AbortSignal) => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await abortAfter(ms, run)
  } catch (e) {
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
    return await abortAfter(TRANSLATE_MS, signal => claudeTranslate(fields, context, signal))
  } finally {
    release()
  }
}

export async function summarizeNotice(title: string, body: string, lang: Lang): Promise<Summary> {
  if (!has.ai) return fakeSummary(title, body)
  return orFallback('summary', SUMMARY_MS, signal => claudeSummary(title, body, lang, signal), () => fakeSummary(title, body))
}

/** 실패하면 원문(한국어) 목록을 그대로 돌려준다 */
export async function translateList(items: string[], lang: Lang): Promise<string[]> {
  if (!has.ai || lang === 'ko' || items.length === 0) return items
  return orFallback('list', LIST_MS, signal => claudeList(items, lang, signal), () => items)
}

export async function parseTimetable(image: ImageInput): Promise<ParsedCourse[]> {
  if (!has.ai) return SAMPLE_TIMETABLE
  return orFallback('timetable', TIMETABLE_MS, signal => claudeTimetable(image, undefined, signal), () => [])
}

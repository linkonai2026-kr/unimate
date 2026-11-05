// 커뮤니티 이용규칙(규칙 화면·AI 검수 지시문이 함께 씀), 신고 사유, 경고 2번 뒤 이용 제한 규칙과 검수 흐름
import type { Lang } from './i18n'
import type { Store } from './store/types'
import type { LiveEvent, Profile } from './types'

/** AI가 고를 수 있는 위반 규칙 id */
export const RULE_IDS = ['respect', 'sexual', 'privacy', 'impersonation', 'spam', 'illegal', 'conflict'] as const
export type RuleId = (typeof RULE_IDS)[number]
export const isRuleId = (v: unknown): v is RuleId => typeof v === 'string' && (RULE_IDS as readonly string[]).includes(v)

/** 이용규칙: 화면에 보이는 순서. id가 없는 항목은 안내일 뿐 검수 대상이 아니다 */
export const RULES: { id?: RuleId; title: string; desc: string }[] = [
  { id: 'respect', title: '서로 존중해요', desc: '특정인이나 집단을 깎아내리는 표현, 욕설, 혐오 표현은 가리고 이용을 제한해요. 국적·언어가 다르다는 이유로 무시하는 글도 마찬가지예요.' },
  { id: 'sexual', title: '음란한 글과 사진은 올리지 않아요', desc: '성적인 묘사, 노출 사진, 성희롱으로 느껴질 수 있는 말은 어느 게시판에서도 안 돼요.' },
  { id: 'privacy', title: '개인정보를 지켜요', desc: '이름, 연락처, 학번처럼 누군가를 알아볼 수 있는 정보를 올리지 마세요. 본인 정보도 마찬가지예요.' },
  { id: 'impersonation', title: '익명을 악용하지 않아요', desc: '익명이라도 작성 기록은 남아요. 같은 사람인 척하거나 다른 사람을 사칭하면 제재해요.' },
  { id: 'spam', title: '광고와 도배는 안 돼요', desc: '홍보는 동아리·모집 게시판에서만, 같은 글을 여러 번 올리는 건 금지예요. 도박·불법 사이트 홍보는 바로 가려요.' },
  { id: 'illegal', title: '사기와 불법은 안 돼요', desc: '중고장터 거래는 사용자끼리 이뤄져요. 선입금 요구, 대리 출석·시험 대행, 불법 물품 거래는 금지예요. 거래는 교내에서 직접 만나서 하세요.' },
  { id: 'conflict', title: '정치·종교 싸움을 걸지 않아요', desc: '특정 정당이나 종교를 공격하거나 편을 갈라 싸움을 부추기는 글은 가려요. 다양한 나라 학생이 함께 쓰는 공간이에요.' },
  { title: '번역은 참고용이에요', desc: '글은 자동으로 번역돼요. 뜻이 애매하면 원문 보기로 확인하고, 오해가 생기면 먼저 물어봐 주세요.' },
]

/** 신고 사유(화면 순서). 'other'는 자세한 내용을 적을 수 있다 */
export const REPORT_REASONS = ['respect', 'sexual', 'spam', 'privacy', 'illegal', 'conflict', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
/** 신고 자세한 내용 최대 길이 */
export const REPORT_DETAIL_MAX = 200

/** 경고로 끝나는 위반 횟수(1·2번째는 경고, 3번째부터 이용 제한) */
export const WARNING_LIMIT = 2
const DAY = 24 * 60 * 60_000
/** 3번째 위반 → 7일, 4번째부터 → 30일 동안 글·댓글·쪽지 금지 */
export const FIRST_SUSPENSION_MS = 7 * DAY
export const REPEAT_SUSPENSION_MS = 30 * DAY
export const REPEAT_SUSPENSION_DAYS = REPEAT_SUSPENSION_MS / DAY

/** 위반 횟수가 count가 됐을 때 새 제한 끝 시각(경고 단계면 이전 값 그대로). 이미 더 긴 제한이 있으면 줄이지 않는다 */
export function nextSuspension(count: number, now: number, prevUntil: number | null | undefined): number | null {
  const prev = prevUntil ?? null
  if (count <= WARNING_LIMIT) return prev
  const until = now + (count === WARNING_LIMIT + 1 ? FIRST_SUSPENSION_MS : REPEAT_SUSPENSION_MS)
  return Math.max(prev ?? 0, until)
}

export type SanctionStatus =
  | { kind: 'suspended'; until: number; rule: RuleId | null }
  | { kind: 'warning'; n: number }
  | { kind: 'repeat'; n: number }

/** 배너에 보일 내 상태. 위반이 없으면 null */
export function sanctionStatus(p: Pick<Profile, 'violations' | 'suspendedUntil' | 'sanctionReason'>, now = Date.now()): SanctionStatus | null {
  if (p.suspendedUntil && p.suspendedUntil > now) return { kind: 'suspended', until: p.suspendedUntil, rule: isRuleId(p.sanctionReason) ? p.sanctionReason : null }
  const n = p.violations ?? 0
  if (n <= 0) return null
  return n <= WARNING_LIMIT ? { kind: 'warning', n } : { kind: 'repeat', n }
}

/** 지금 글·댓글·쪽지를 쓸 수 없는 사람인지 */
export const isSuspended = (p: Pick<Profile, 'suspendedUntil'>, now = Date.now()) => !!p.suspendedUntil && p.suspendedUntil > now

const kstFormat = new Map<Lang, Intl.DateTimeFormat>()
/** 제한 끝 시각을 한국 시간으로(예: 2026. 11. 12. 오후 3:00) */
export function kstTime(ts: number, lang: Lang): string {
  let f = kstFormat.get(lang)
  if (!f) kstFormat.set(lang, (f = new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })))
  return f.format(new Date(ts))
}

/** AI 검수 결과 */
export interface Verdict { violation: boolean; rule: RuleId | 'none'; severity: 'low' | 'high'; reason: string }
export type ModerationInput = { title?: string; body: string }
export type ReviewOutcome = 'violation' | 'clean' | 'skipped' | 'error'

/** 검수에 필요한 것(스토어, 검수기, 실시간 알림) */
export interface ModerationDeps {
  store: Pick<Store, 'getPost' | 'getComment' | 'applyViolation' | 'resolveReports'>
  /** 실패·시간 초과면 null(제재하지 않는다) */
  moderate: (input: ModerationInput) => Promise<Verdict | null>
  publish: (e: LiveEvent) => Promise<void>
}

/**
 * 글·댓글 하나를 AI로 검수하고, 위반이면 가리고 작성자 위반 횟수를 올린다(같은 글은 한 번만 센다).
 * 검수기가 실패하면 아무것도 하지 않는다(신고는 'pending'으로 남는다). 이미 가려진 글은 다시 보지 않는다
 */
export async function reviewContent(d: ModerationDeps, kind: 'post' | 'comment', id: string, now = () => Date.now()): Promise<ReviewOutcome> {
  const row = kind === 'post' ? await d.store.getPost(id) : await d.store.getComment(id)
  if (!row) return 'skipped'
  if (row.hidden) {
    await d.store.resolveReports(kind, id, 'violation').catch(() => {})
    return 'skipped'
  }
  const verdict = await d.moderate('title' in row ? { title: row.title, body: row.body } : { body: row.body })
  if (!verdict) return 'error'
  if (!verdict.violation || verdict.rule === 'none') {
    await d.store.resolveReports(kind, id, 'clean').catch(() => {})
    return 'clean'
  }
  await d.store.applyViolation(kind, id, verdict.rule, now())
  await d.store.resolveReports(kind, id, 'violation').catch(() => {})
  // 보고 있는 화면이 새로 그려져 가린 글이 바로 사라지게
  const topics = 'postId' in row ? [`post:${row.postId}`] : [`board:${row.board}`, 'board:all', `post:${row.id}`]
  await Promise.all(topics.map(topic => d.publish({ topic, kind: 'del', id }))).catch(() => {})
  return 'violation'
}

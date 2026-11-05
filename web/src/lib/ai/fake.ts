// API 키가 없거나 호출이 실패할 때 쓰는 AI 대역
import { LANGS, type Lang } from '../i18n'
import type { ModerationInput, RuleId, Verdict } from '../moderation'
import { DEMO_TR } from '../store/seed'
import type { TrMap } from '../types'
import type { Summary } from './index'

export { SAMPLE_TIMETABLE } from '../timetable/sample'

// ponytail: 글자 종류로만 언어를 짐작한다. 진짜 감지는 Claude가 한다
export function guessLang(text: string): Lang {
  if (/[가-힣]/.test(text)) return 'ko'
  if (/[一-鿿]/.test(text)) return 'zh'
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text)) return 'vi'
  if (/[oOgG][ʻ'‘’]|\b(qayer|bilan|uchun|yoki)\b/i.test(text)) return 'uz'
  return 'en'
}

/** DEMO_TR에 있는 문장이면 그 원문 언어(사전 키가 객체 기본 속성과 겹쳐도 잘못 잡지 않게 자기 키만 본다) */
const demoRow = (text: string) => (Object.hasOwn(DEMO_TR, text) ? DEMO_TR[text] : undefined)
function demoLang(text: string): Lang | null {
  const row = demoRow(text)
  return row ? (Object.keys(row) as Lang[]).find(l => row[l] === text) ?? null : null
}

export function fakeTranslate(fields: Record<string, string>): { detected: Lang; tr: TrMap } {
  const texts = Object.values(fields)
  const first = texts.find(Boolean) ?? ''
  const detected = demoLang(first) ?? guessLang(texts.join(' '))
  const tr: TrMap = {}
  for (const { code } of LANGS) {
    const row: Record<string, string> = {}
    for (const [f, text] of Object.entries(fields)) row[f] = demoRow(text)?.[code] ?? (code === detected ? text : `[${code}] ${text}`)
    tr[code] = row
  }
  return { detected, tr }
}

/** 모든 필드가 데모 대본 문장일 때만 사전 번역을 돌려준다 */
export function demoTranslate(fields: Record<string, string>): { detected: Lang; tr: TrMap } | null {
  const texts = Object.values(fields)
  return texts.length > 0 && texts.every(t => demoRow(t)) ? fakeTranslate(fields) : null
}

/** 앞 문장 세 개를 요약 줄로, 본문에 날짜가 보이면 마감으로 */
export function fakeSummary(title: string, body: string): Summary {
  const sentences = body.split(/(?<=[.!?。])\s+|\n+/).map(s => s.trim()).filter(Boolean)
  const bullets = [...sentences, title, title, title].map(s => s.trim()).filter(Boolean).slice(0, 3)
  const m = body.match(/\d{4}\.\s?\d{1,2}\.\s?\d{1,2}|\d{1,2}월\s?\d{1,2}일/)
  return { bullets, deadline: m ? m[0] : null }
}

/**
 * 키 없이 도는 검수 대역(테스트·E2E용): 뻔한 욕설·도박 광고 몇 개와 테스트 전용 표시어만 위반으로 본다.
 * ("시발점"처럼 평범한 낱말 안에 들어가는 글자는 넣지 않는다)
 */
export const FAKE_VIOLATION_MARKER = 'UNIMATE-MOD-TEST'
const FAKE_BANNED: [string, RuleId][] = [
  [FAKE_VIOLATION_MARKER.toLowerCase(), 'respect'],
  ['씨발', 'respect'], ['병신', 'respect'], ['개새끼', 'respect'], ['fuck', 'respect'],
  ['토토사이트', 'spam'], ['카지노', 'spam'], ['casino', 'spam'],
]

export function fakeModerate(input: ModerationInput): Verdict {
  const text = `${input.title ?? ''}
${input.body}`.toLowerCase()
  const hit = FAKE_BANNED.find(([word]) => text.includes(word))
  return hit
    ? { violation: true, rule: hit[1], severity: 'high', reason: 'Matched a banned word (offline moderator).' }
    : { violation: false, rule: 'none', severity: 'low', reason: 'No banned word (offline moderator).' }
}

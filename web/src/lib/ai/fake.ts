// API 키가 없거나 호출이 실패할 때 쓰는 AI 대역
import { LANGS, type Lang } from '../i18n'
import type { ModerationInput, RuleId, Verdict } from '../moderation'
import { DEMO_TR } from '../store/seed'
import type { TrMap } from '../types'
import type { MailDraft, MailInput, Summary } from './index'

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
  // 신청 방법 짐작: 본문에 주소가 있으면 온라인, "방문·제출"이 보이면 방문 제출(서류 목록은 Claude만 뽑는다)
  const url = body.match(/https?:\/\/[^\s<>"')]+/)?.[0] ?? null
  const how = url ? 'online' : /방문|제출/.test(body) ? 'visit' : null
  return { bullets, deadline: m ? m[0] : null, apply: how ? { how, where: null, url, documents: [] } : null }
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

/**
 * 키 없이(또는 AI 실패 때) 쓰는 신청 메일 틀: 공지 제목·마감·준비물과 학생 정보만으로 한국어 메일을 쓰고,
 * 같은 내용을 학생 언어로 옮긴 틀을 붙인다. 공지에 없는 사실은 넣지 않는다
 */
export function fakeMail({ notice: n, student: s }: MailInput, lang: Lang): MailDraft {
  const byMail = n.apply?.how === 'email'
  const docs = n.apply?.documents ?? []
  const who = [s.major, s.studentId, s.name].filter(Boolean).join(' ')
  const name = s.name || who || '학생'
  const ko = {
    subject: `[${byMail ? '신청' : '문의'}] ${n.title}${s.name ? ` - ${s.name}` : ''}`,
    body: [
      `안녕하세요.${who ? ` ${who}입니다.` : ''}`,
      '',
      `「${n.title}」 공지를 보고 ${byMail ? '신청합니다.' : '신청하고자 연락드립니다.'}`,
      ...(n.deadline ? [`마감(${n.deadline}) 전에 처리하고 싶습니다.`] : []),
      ...(docs.length ? [`${byMail ? '첨부한 서류' : '준비한 서류'}: ${docs.join(', ')}`] : []),
      byMail ? '확인 부탁드립니다.' : '신청 방법이나 추가로 필요한 것이 있으면 알려 주시면 감사하겠습니다.',
      '',
      '감사합니다.',
      `${name} 드림`,
    ].join('\n'),
  }
  if (lang === 'ko') return { ...ko, subjectTr: ko.subject, bodyTr: ko.body }
  const L: Record<Exclude<Lang, 'ko'>, { hi: string; me: (w: string) => string; about: (t: string) => string; apply: string; ask: string; due: (d: string) => string; docs: string; check: string; more: string; thanks: string; subj: string }> = {
    en: { hi: 'Hello.', me: w => `I am ${w}.`, about: t => `I saw the notice "${t}"`, apply: 'and I am applying.', ask: 'and I am writing to apply.', due: d => `I would like to finish this before the deadline (${d}).`, docs: 'Documents', check: 'Please check it.', more: 'Please let me know how to apply or if anything else is needed.', thanks: 'Thank you.', subj: byMail ? 'Application' : 'Inquiry' },
    vi: { hi: 'Xin chào.', me: w => `Em là ${w}.`, about: t => `Em đã xem thông báo "${t}"`, apply: 'và em xin đăng ký.', ask: 'và em liên hệ để đăng ký.', due: d => `Em muốn hoàn thành trước hạn chót (${d}).`, docs: 'Hồ sơ', check: 'Mong thầy/cô kiểm tra giúp em.', more: 'Mong thầy/cô cho em biết cách đăng ký hoặc cần thêm gì.', thanks: 'Em cảm ơn.', subj: byMail ? 'Đăng ký' : 'Hỏi' },
    zh: { hi: '您好。', me: w => `我是${w}。`, about: t => `我看到了「${t}」的通知，`, apply: '现提出申请。', ask: '想联系您进行申请。', due: d => `希望在截止日期（${d}）前完成。`, docs: '材料', check: '请您确认。', more: '如需了解申请方法或还需要其他材料，请告诉我。', thanks: '谢谢。', subj: byMail ? '申请' : '咨询' },
    uz: { hi: 'Assalomu alaykum.', me: w => `Men ${w}.`, about: t => `"${t}" e'lonini ko'rdim`, apply: 'va ariza topshiraman.', ask: 'va ariza topshirish uchun murojaat qilyapman.', due: d => `Muddatgacha (${d}) bajarmoqchiman.`, docs: 'Hujjatlar', check: "Iltimos, tekshirib ko'ring.", more: "Ariza tartibi yoki yana nima kerakligini aytsangiz, minnatdor bo'lardim.", thanks: 'Rahmat.', subj: byMail ? 'Ariza' : "So'rov" },
  }
  const x = L[lang]
  return {
    ...ko,
    subjectTr: `[${x.subj}] ${n.title}${s.name ? ` - ${s.name}` : ''}`,
    bodyTr: [
      `${x.hi}${who ? ` ${x.me(who)}` : ''}`,
      '',
      `${x.about(n.title)} ${byMail ? x.apply : x.ask}`,
      ...(n.deadline ? [x.due(n.deadline)] : []),
      ...(docs.length ? [`${x.docs}: ${docs.join(', ')}`] : []),
      byMail ? x.check : x.more,
      '',
      x.thanks,
      name,
    ].join('\n'),
  }
}

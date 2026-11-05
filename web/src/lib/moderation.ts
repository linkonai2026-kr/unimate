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

/** 이용규칙 번역(RULES와 같은 순서). 규칙 화면이 AI를 부르지 않도록 미리 옮겨 둔다. 규칙을 고치면 여기도 함께 고친다 */
export const RULES_TR: Record<Exclude<Lang, 'ko'>, { title: string; desc: string }[]> = {
  en: [
    { title: "Respect each other", desc: "Expressions that put down specific people or groups, profanity, and hate speech will be hidden, and your use of the app may be restricted. The same goes for posts that look down on someone because of their nationality or language." },
    { title: "Don't post obscene text or photos", desc: "Sexual descriptions, nude photos, and words that could feel like sexual harassment are not allowed on any board." },
    { title: "Protect personal information", desc: "Please don't post information that could identify someone, such as a name, contact details, or student ID number. The same goes for your own information." },
    { title: "Don't abuse anonymity", desc: "Even when you post anonymously, a record of what you wrote is kept. Pretending to be the same person as someone else or impersonating another person will result in sanctions." },
    { title: "No ads or spamming", desc: "Promotion is only allowed on the club and recruitment boards, and posting the same post many times is banned. Promotions for gambling or illegal sites are hidden right away." },
    { title: "No scams or illegal activity", desc: "Deals in the secondhand market are made between users. Asking for payment upfront, proxy attendance, exam-taking services, and trading illegal items are banned. Please meet in person on campus to make a deal." },
    { title: "Don't start political or religious fights", desc: "Posts that attack a particular political party or religion, or split people into sides and stir up fights, will be hidden. This is a space shared by students from many countries." },
    { title: "Translations are for reference", desc: "Posts are translated automatically. If the meaning is unclear, check the original text using \"View original,\" and if a misunderstanding comes up, please ask first." },
  ],
  vi: [
    { title: "Hãy tôn trọng lẫn nhau", desc: "Những lời lẽ hạ thấp một cá nhân hay nhóm người cụ thể, chửi thề và ngôn từ thù ghét sẽ bị ẩn đi và việc sử dụng ứng dụng có thể bị hạn chế. Những bài viết coi thường người khác vì khác quốc tịch hay ngôn ngữ cũng vậy." },
    { title: "Không đăng bài viết và hình ảnh khiêu dâm", desc: "Những mô tả tình dục, ảnh khoả thân hay lời nói có thể bị cảm nhận là quấy rối tình dục đều không được phép trên bất kỳ bảng tin nào." },
    { title: "Bảo vệ thông tin cá nhân", desc: "Đừng đăng những thông tin có thể nhận ra một ai đó như tên, thông tin liên lạc, mã số sinh viên. Thông tin của chính bạn cũng vậy nhé." },
    { title: "Không lợi dụng tính ẩn danh", desc: "Dù ẩn danh thì lịch sử đăng bài vẫn được lưu lại. Giả làm cùng một người hay mạo danh người khác sẽ bị xử lý." },
    { title: "Không quảng cáo và đăng bài spam", desc: "Chỉ được quảng bá ở bảng tin câu lạc bộ và tuyển người, và cấm đăng đi đăng lại cùng một bài nhiều lần. Quảng cáo cờ bạc hay trang web bất hợp pháp sẽ bị ẩn ngay." },
    { title: "Không lừa đảo và vi phạm pháp luật", desc: "Giao dịch ở chợ đồ cũ diễn ra trực tiếp giữa các người dùng với nhau. Cấm yêu cầu chuyển tiền trước, điểm danh hộ, làm bài thi hộ và mua bán hàng bất hợp pháp. Hãy gặp mặt trực tiếp trong khuôn viên trường để giao dịch nhé." },
    { title: "Không gây tranh cãi về chính trị, tôn giáo", desc: "Những bài viết công kích một đảng phái hay tôn giáo cụ thể, hoặc chia phe để kích động cãi nhau sẽ bị ẩn. Đây là không gian chung của sinh viên đến từ nhiều quốc gia." },
    { title: "Bản dịch chỉ để tham khảo", desc: "Bài viết được dịch tự động. Nếu nghĩa chưa rõ, hãy bấm xem bản gốc để kiểm tra, và nếu có hiểu lầm thì hãy hỏi trước nhé." },
  ],
  zh: [
    { title: "互相尊重", desc: "贬低特定个人或群体的言论、脏话和仇恨言论会被隐藏,并可能限制使用。因为国籍、语言不同而轻视他人的帖子也一样。" },
    { title: "不发布淫秽的文字和照片", desc: "性描写、裸露照片,以及可能被视为性骚扰的言语,在任何板块都不允许。" },
    { title: "保护个人信息", desc: "请不要发布姓名、联系方式、学号等可以识别出某个人的信息。自己的信息也一样。" },
    { title: "不滥用匿名", desc: "即使是匿名,发帖记录也会保留。假装成同一个人或冒充他人,将会受到处罚。" },
    { title: "不发广告,不刷屏", desc: "宣传只能在社团和招募板块进行,禁止多次重复发布同一内容。赌博和非法网站的宣传会被立即隐藏。" },
    { title: "不诈骗,不违法", desc: "二手市场的交易是用户之间进行的。禁止要求预付款、代点名、代考以及交易违禁物品。请在校内当面交易。" },
    { title: "不挑起政治、宗教纷争", desc: "攻击特定政党或宗教,或者分裂阵营、煽动争吵的帖子会被隐藏。这里是来自不同国家的学生共同使用的空间。" },
    { title: "翻译仅供参考", desc: "帖子会被自动翻译。如果意思不清楚,请点击查看原文确认;如果产生了误会,请先询问对方。" },
  ],
  uz: [
    { title: "Bir-birimizni hurmat qilaylik", desc: "Muayyan shaxs yoki guruhni kamsituvchi iboralar, so'kinish va nafrat uyg'otuvchi gaplar yashiriladi va foydalanish cheklanishi mumkin. Millati yoki tili boshqa ekanini bahona qilib mensimaydigan postlar ham xuddi shunday." },
    { title: "Odobsiz matn va rasmlarni joylamaymiz", desc: "Jinsiy tasvirlar, yalang'och rasmlar va jinsiy bezovtalik sifatida qabul qilinishi mumkin bo'lgan gaplar hech bir bo'limda mumkin emas." },
    { title: "Shaxsiy ma'lumotlarni himoya qilamiz", desc: "Ism, aloqa ma'lumotlari, talaba raqami kabi kimnidir aniqlash mumkin bo'lgan ma'lumotlarni joylamang. O'zingizning ma'lumotlaringiz ham shunday." },
    { title: "Anonimlikni suiiste'mol qilmaymiz", desc: "Anonim bo'lsa ham yozgan narsangiz yozuvi saqlanib qoladi. O'zini boshqa bir odam bilan bir xil shaxs qilib ko'rsatish yoki boshqani o'zini o'rniga qo'yib yozish jazolanadi." },
    { title: "Reklama va spam mumkin emas", desc: "Reklama faqat klub va a'zo yig'ish bo'limlarida mumkin, bir xil postni ko'p marta joylash taqiqlanadi. Qimor va noqonuniy saytlar reklamasi darhol yashiriladi." },
    { title: "Firibgarlik va qonunbuzarlik mumkin emas", desc: "Ishlatilgan buyumlar bozoridagi bitimlar foydalanuvchilar o'rtasida amalga oshadi. Oldindan pul so'rash, o'rniga davomatga kirish yoki imtihon topshirish va noqonuniy buyumlar savdosi taqiqlanadi. Bitimni kampus ichida yuzma-yuz uchrashib qiling." },
    { title: "Siyosat va din bo'yicha janjal qo'zg'atmaymiz", desc: "Muayyan siyosiy partiya yoki dinga hujum qiladigan, odamlarni guruhlarga bo'lib janjalga undaydigan postlar yashiriladi. Bu turli mamlakatlardan kelgan talabalar birga foydalanadigan joy." },
    { title: "Tarjima faqat ma'lumot uchun", desc: "Postlar avtomatik tarjima qilinadi. Ma'nosi tushunarsiz bo'lsa, asl matnni ko'rib tekshiring, tushunmovchilik yuzaga kelsa, avval so'rab ko'ring." },
  ],
  ja: [
    { title: "お互いを尊重しましょう", desc: "特定の人や集団をおとしめる表現、暴言、ヘイト表現は非表示にし、利用を制限します。国籍や言語が違うという理由で見下す投稿も同じです。" },
    { title: "わいせつな文章や写真は投稿しません", desc: "性的な描写、露出写真、セクハラと感じられる言葉は、どの掲示板でも禁止です。" },
    { title: "個人情報を守りましょう", desc: "名前、連絡先、学籍番号など、誰かが特定できる情報は投稿しないでください。自分の情報も同じです。" },
    { title: "匿名を悪用しません", desc: "匿名でも、書き込みの記録は残ります。同じ人のふりをしたり、他の人になりすましたりすると、制裁を受けます。" },
    { title: "広告と連投はダメです", desc: "宣伝はサークル・募集掲示板だけで、同じ投稿を何度も載せるのは禁止です。ギャンブルや違法サイトの宣伝はすぐに非表示にします。" },
    { title: "詐欺や違法行為はダメです", desc: "中古マーケットの取引は、利用者同士で行われます。先払いの要求、代返・試験の代行、違法な物品の取引は禁止です。取引は学内で直接会ってしてくださいね。" },
    { title: "政治・宗教でケンカを売りません", desc: "特定の政党や宗教を攻撃したり、対立をあおってケンカをけしかけたりする投稿は非表示にします。いろいろな国の学生が一緒に使う場所です。" },
    { title: "翻訳は参考用です", desc: "投稿は自動で翻訳されます。意味がはっきりしないときは原文を見て確認し、誤解が生じたらまず聞いてみてくださいね。" },
  ],
}

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

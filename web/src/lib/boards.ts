// 게시판 목록과 HOT·BEST 가상 게시판 상수(에브리타임 역설계 index.html에서 이식, 문구 새로 작성)
import type { Lang } from './i18n'

type Row = Record<Lang, string>
const r = (ko: string, en: string, vi: string, zh: string, uz: string): Row => ({ ko, en, vi, zh, uz })

export const BOARDS = [
  { id: 'free', name: r('자유게시판', 'Free board', 'Diễn đàn tự do', '自由版', 'Erkin forum'), desc: r('수업, 일상, 잡담 무엇이든', 'Classes, daily life, anything', 'Học tập, đời sống, chuyện gì cũng được', '课程、日常，什么都可以聊', "Darslar, kundalik hayot, istalgan mavzu") },
  { id: 'global', name: r('유학생게시판', 'International', 'Du học sinh', '留学生版', 'Xorijiy talabalar'), desc: r('모국어로 편하게, 알아서 번역돼요', 'Write in your language, we translate', 'Viết bằng tiếng mẹ đẻ, tự động dịch', '用母语写，自动翻译', "Ona tilingizda yozing, tarjima qilinadi") },
  { id: 'secret', name: r('비밀게시판', 'Secret board', 'Bí mật', '秘密版', 'Maxfiy forum'), desc: r('항상 익명으로 올라가요', 'Always anonymous', 'Luôn ẩn danh', '始终匿名', 'Doim anonim'), anonOnly: true },
  { id: 'fresh', name: r('새내기게시판', 'Freshmen', 'Tân sinh viên', '新生版', 'Birinchi kurslar'), desc: r('처음이라 궁금한 건 여기서', 'New here? Ask anything', 'Mới đến? Hỏi gì cũng được', '新来的？随便问', "Yangimisiz? Bemalol so'rang") },
  { id: 'info', name: r('정보게시판', 'Info', 'Thông tin', '信息版', "Ma'lumot"), desc: r('장학금, 학사 일정, 꿀팁 공유', 'Scholarships, schedules, tips', 'Học bổng, lịch học, mẹo hay', '奖学金、学事日程、小贴士', 'Stipendiya, jadval, maslahatlar') },
  { id: 'market', name: r('중고장터', 'Market', 'Chợ đồ cũ', '二手市场', 'Bozor'), desc: r('전공책과 자취템을 사고팔아요', 'Buy and sell textbooks and more', 'Mua bán sách và đồ dùng', '买卖教材和生活用品', 'Kitob va buyumlar oldi-sotdisi') },
  { id: 'club', name: r('동아리·모집', 'Clubs', 'Câu lạc bộ', '社团·招募', "To'garaklar"), desc: r('동아리, 학회, 팀원 모집', 'Clubs, study groups, teammates', 'CLB, nhóm học, tìm đồng đội', '社团、学会、招募队友', "To'garak, guruh, jamoadosh izlash") },
]

export const VIRTUAL = {
  hot: { name: r('HOT 게시판', 'HOT', 'HOT', '热门', 'HOT'), desc: r('공감 10개를 넘긴 글', 'Posts with 10+ likes', 'Bài có hơn 10 lượt thích', '获赞10个以上的帖子', "10 tadan ko'p yoqtirilganlar") },
  best: { name: r('BEST 게시판', 'BEST', 'BEST', '精选', 'BEST'), desc: r('공감을 가장 많이 받은 글', 'Most liked posts', 'Bài được thích nhiều nhất', '获赞最多的帖子', "Eng ko'p yoqtirilganlar") },
}
export type VirtualId = keyof typeof VIRTUAL

export const HOT_MIN = 10

/** 'toString'·'__proto__' 같은 객체 기본 속성이 가상 게시판으로 잡히지 않게 자기 키만 본다 */
export const isVirtual = (id: string): id is VirtualId => Object.hasOwn(VIRTUAL, id)

export const boardOf = (id: string) => BOARDS.find(b => b.id === id)
export const boardName = (id: string, lang: Lang) => boardOf(id)?.name[lang] ?? (isVirtual(id) ? VIRTUAL[id].name[lang] : id)

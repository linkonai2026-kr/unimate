// 방문객 모드(로그인 없이 교직원·지역 주민·방문객이 쓰는 화면) 공통: 언어를 유지하는 주소, 자주 찾는 곳
import type { Lang } from './i18n'
import { buildingById, buildingName } from './map/buildings'
import { FACILITIES, facilityView } from './map/facilities'

/** 방문객 화면 주소. 로그인이 없어서 언어는 늘 ?lang=으로 들고 다닌다(빈 값은 빼고, lang은 항상 마지막) */
export function visitHref(path: string, lang: Lang, query: Record<string, string | undefined> = {}): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (k !== 'lang' && v) sp.set(k, v)
  sp.set('lang', lang)
  return `${path}?${sp}`
}

/** 방문객이 자주 찾는 곳(행사·면접·민원·운동): 정문안내실, 대학본부, 도서관, 학생회관(식당), 복합스포츠센터 */
export const POPULAR = ['mainguard', 'hq', 'library', 'union', 'sportscenter'] as const

// 대상별 안내: 학생이 아닌 사람이 처음 왔을 때 "내게 맞는 것"을 바로 찾게 묶어 둔다. 자리·전화는 facilities.ts의 시설 자료를 그대로 쓴다
type L5 = Record<Lang, string>
const L = (ko: string, en: string, vi: string, zh: string, uz: string, ja: string): L5 => ({ ko, en, vi, zh, uz, ja })

export type AudienceId = 'visitor' | 'resident' | 'staff'
export interface AudienceGroup {
  id: AudienceId
  title: L5
  desc: L5
  /** 건물 id와, 그 건물 시설 가운데 보여 줄 것(한국어 이름으로 찾음). 시설 이름이 없으면 건물만 */
  places: { building: string; facility?: string }[]
}

export const AUDIENCE: AudienceGroup[] = [
  {
    id: 'visitor',
    title: L('방문객·학부모', 'Visitors & parents', 'Khách & phụ huynh', '访客·家长', 'Mehmonlar va ota-onalar', '訪問者・保護者'),
    desc: L('행사·면접·상담으로 오셨다면 여기서 시작하세요.', 'Here for an event, interview or meeting? Start here.', 'Đến dự sự kiện, phỏng vấn hay gặp mặt? Bắt đầu từ đây.', '参加活动、面试或咨询，从这里开始。', 'Tadbir, suhbat yoki uchrashuvga keldingizmi? Shu yerdan boshlang.', 'イベント・面接・相談でお越しの方は、ここから始めましょう。'),
    places: [
      { building: 'mainguard' },
      { building: 'hq', facility: '셔틀버스 문의' },
      { building: 'union2', facility: '게스트하우스' },
      { building: 'greenenergy', facility: '커피점' },
    ],
  },
  {
    id: 'resident',
    title: L('지역 주민', 'Neighbors', 'Người dân địa phương', '当地居民', 'Mahalliy aholi', '地域住民の方'),
    desc: L('식당·편의점·우편·서점은 누구나 쓸 수 있어요. 도서관·운동 시설은 전화로 확인하세요.', 'Cafeterias, stores, post office and bookstore are open to everyone. Call ahead for the library and gym.', 'Nhà ăn, cửa hàng, bưu cục và hiệu sách mở cho mọi người. Thư viện và phòng gym: gọi trước.', '食堂、便利店、邮局、书店对外开放。图书馆和健身房请先电话确认。', 'Oshxona, do‘kon, pochta va kitob do‘koni hamma uchun ochiq. Kutubxona va sport zali uchun oldin qo‘ng‘iroq qiling.', '食堂・コンビニ・郵便局・書店はどなたでもご利用いただけます。図書館・運動施設は電話でご確認ください。'),
    places: [
      { building: 'union', facility: '우편취급국(우편·택배)' },
      { building: 'eng5', facility: '학생·교직원 식당' },
      { building: 'library', facility: '도서관 이용자서비스센터' },
      { building: 'sportscenter', facility: '휘트니스센터' },
    ],
  },
  {
    id: 'staff',
    title: L('교직원', 'Faculty & staff', 'Cán bộ & giảng viên', '教职工', 'Xodimlar', '教職員'),
    desc: L('식당·IT 지원·일반공지를 바로 찾을 수 있어요. 가입하면 게시판·쪽지도 쓸 수 있어요.', 'Cafeteria, IT support and general notices in one place. Sign up to use the boards and messages too.', 'Nhà ăn, hỗ trợ IT và thông báo chung ở một nơi. Đăng ký để dùng cả bảng tin và tin nhắn.', '食堂、IT支持和一般通知一目了然。注册后还可使用社区和私信。', 'Oshxona, IT yordami va umumiy e’lonlar bir joyda. Ro‘yxatdan o‘tsangiz forum va xabarlar ham ochiladi.', '食堂・ITサポート・一般のお知らせにすぐアクセスできます。登録すると掲示板やメッセージも使えます。'),
    places: [
      { building: 'eng5', facility: '학생·교직원 식당' },
      { building: 'itc', facility: 'IT 서비스센터(웹메일·K-Cloud·Wi-Fi)' },
      { building: 'lab', facility: '안전보건관리센터' },
    ],
  },
]

export const AUDIENCE_TITLE = L('어떤 분이세요?', 'Who are you?', 'Bạn là ai?', '您是哪类访客？', 'Siz kimsiz?', 'あなたはどちらですか？')
export const STAFF_NOTICES = L('일반공지 보기', 'General notices', 'Thông báo chung', '查看一般通知', 'Umumiy e’lonlar', '一般のお知らせを見る')

export type AudiencePlace = { building: string; buildingName: string; name: string; where: string; hours: string; tel: string; open: string }
export type AudienceView = { id: AudienceId; title: string; desc: string; places: AudiencePlace[] }

/** 화면에 그릴 대상별 묶음(보는 사람 언어). 없는 건물·시설은 조용히 뺀다 */
export function audienceView(lang: Lang): AudienceView[] {
  return AUDIENCE.map(g => ({
    id: g.id,
    title: g.title[lang],
    desc: g.desc[lang],
    places: g.places.flatMap(p => {
      const b = buildingById(p.building)
      if (!b) return []
      const raw = p.facility ? (FACILITIES[p.building] ?? []).find(f => f.name.ko === p.facility) : undefined
      if (p.facility && !raw) return []
      const v = raw ? facilityView(raw, lang) : null
      return [{ building: b.id, buildingName: buildingName(b, lang), name: v?.name ?? buildingName(b, lang), where: v?.where ?? '', hours: v?.hours ?? '', tel: v?.tel ?? '', open: v?.open ?? '' }]
    }),
  }))
}

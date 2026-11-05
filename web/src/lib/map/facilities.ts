// 건물 안 시설·위치·운영시간·전화(2026 대학생활 가이드북 삼척캠퍼스 기준)와 보는 사람 언어로 바꾸기
import type { Lang } from '../i18n'

type L5 = Record<Lang, string>
const L = (ko: string, en: string, vi: string, zh: string, uz: string): L5 => ({ ko, en, vi, zh, uz })

export type FacilityKind = 'food' | 'store' | 'cafe' | 'health' | 'counsel' | 'office' | 'rest' | 'sports' | 'service' | 'dorm'
type Days = 'weekdays' | 'monThu' | 'fri'
export interface Facility {
  kind: FacilityKind
  name: L5
  floor?: number
  room?: string
  outdoor?: boolean
  hours?: { days: Days; open: string; close: string }[]
  /** 국번 570 등(지역번호 033 없이) */
  tel?: string
  /** 학생이 아니어도 쓸 수 있는지: anyone = 누구나(상점·식당·우편처럼 열려 있는 곳), inquire = 외부인 이용 여부는 전화로 확인 */
  open?: 'anyone' | 'inquire'
}

const WEEKDAYS_9_18 = [{ days: 'weekdays' as const, open: '09:00', close: '18:00' }]

export const FACILITIES: Record<string, Facility[]> = {
  eng5: [
    { kind: 'food', name: L('학생·교직원 식당', 'Student & staff cafeteria', 'Nhà ăn sinh viên & cán bộ', '学生·教职工食堂', 'Talaba va xodimlar oshxonasi'), floor: 1, tel: '570-6757', open: 'anyone' },
    { kind: 'store', name: L('편의점 CU', 'CU convenience store', 'Cửa hàng tiện lợi CU', 'CU便利店', 'CU do‘koni'), floor: 1, tel: '570-6760', open: 'anyone' },
    { kind: 'cafe', name: L('커피점', 'Coffee shop', 'Quán cà phê', '咖啡店', 'Qahvaxona'), floor: 1, tel: '570-6760', open: 'anyone' },
    { kind: 'rest', name: L('휴게 공간', 'Lounge', 'Khu nghỉ', '休息区', 'Dam olish joyi'), floor: 1 },
  ],
  library: [
    { kind: 'service', name: L('도서관 이용자서비스센터', 'Library service desk', 'Quầy dịch vụ thư viện', '图书馆服务台', 'Kutubxona xizmat markazi'), floor: 1, hours: [{ days: 'weekdays', open: '09:00', close: '20:00' }], tel: '570-6274', open: 'inquire' },
    { kind: 'store', name: L('편의점 CU', 'CU convenience store', 'Cửa hàng tiện lợi CU', 'CU便利店', 'CU do‘koni'), outdoor: true, open: 'anyone' },
  ],
  greenenergy: [
    { kind: 'office', name: L('학생증 발급', 'Student ID card', 'Cấp thẻ sinh viên', '学生证办理', 'Talaba guvohnomasi'), floor: 4, room: '409', tel: '570-6462' },
    { kind: 'office', name: L('장학금 문의', 'Scholarships', 'Học bổng', '奖学金咨询', 'Stipendiya'), floor: 4, tel: '570-6218' },
    { kind: 'office', name: L('수강신청·학사 문의', 'Course registration & academics', 'Đăng ký học phần & học vụ', '选课·学务咨询', 'Kursga yozilish va o‘quv ishlari'), floor: 5, room: '506', tel: '570-6425' },
    { kind: 'health', name: L('보건진료실', 'Health clinic', 'Phòng y tế', '保健室', 'Tibbiyot xonasi'), floor: 2, hours: WEEKDAYS_9_18, tel: '570-6222', open: 'inquire' },
    { kind: 'counsel', name: L('학생상담센터', 'Student counseling center', 'Trung tâm tư vấn sinh viên', '学生咨询中心', 'Talabalar psixologik markazi'), floor: 2, tel: '570-6295' },
    { kind: 'counsel', name: L('인권센터', 'Human rights center', 'Trung tâm nhân quyền', '人权中心', 'Inson huquqlari markazi'), floor: 2, hours: WEEKDAYS_9_18, tel: '570-6222' },
    { kind: 'service', name: L('장애학생지원센터', 'Disability support center', 'Trung tâm hỗ trợ sinh viên khuyết tật', '残障学生支援中心', 'Nogironligi bor talabalarni qo‘llab-quvvatlash markazi'), floor: 2, tel: '570-6295' },
    { kind: 'counsel', name: L('취업지원센터', 'Career center', 'Trung tâm hỗ trợ việc làm', '就业支援中心', 'Ishga joylashish markazi'), floor: 2, room: '206', tel: '570-6231' },
    { kind: 'office', name: L('국제교류', 'International exchange', 'Giao lưu quốc tế', '国际交流', 'Xalqaro almashinuv'), floor: 9, tel: '570-6893' },
    { kind: 'cafe', name: L('커피점', 'Coffee shop', 'Quán cà phê', '咖啡店', 'Qahvaxona'), floor: 10, tel: '570-6717', open: 'anyone' },
    { kind: 'rest', name: L('복합휴게실(잡카페·북카페)', 'Lounge (job & book café)', 'Phòng nghỉ (job café, book café)', '综合休息室（就业·读书咖啡）', 'Dam olish xonasi (ish va kitob kafesi)'), floor: 10 },
  ],
  union: [
    { kind: 'rest', name: L('학생 휴게실', 'Student lounge', 'Phòng nghỉ sinh viên', '学生休息室', 'Talabalar dam olish xonasi'), floor: 1 },
    { kind: 'service', name: L('우편취급국(우편·택배)', 'Post office (mail & parcels)', 'Bưu cục (thư & bưu kiện)', '邮政代办所（邮件·快递）', 'Pochta (xat va posilka)'), floor: 1, tel: '570-6753', open: 'anyone' },
    { kind: 'store', name: L('서점', 'Bookstore', 'Hiệu sách', '书店', 'Kitob do‘koni'), floor: 1, tel: '575-3360', open: 'anyone' },
    { kind: 'store', name: L('문구점', 'Stationery store', 'Văn phòng phẩm', '文具店', 'Kanselyariya do‘koni'), floor: 1, tel: '574-8383', open: 'anyone' },
    { kind: 'service', name: L('복사점', 'Copy & print shop', 'Tiệm photocopy', '复印店', 'Nusxa ko‘chirish'), floor: 1, tel: '573-9518', open: 'anyone' },
    { kind: 'service', name: L('미용실', 'Hair salon', 'Tiệm cắt tóc', '美发店', 'Sartaroshxona'), floor: 1, tel: '573-7977', open: 'anyone' },
    { kind: 'rest', name: L('휴게 공간·파우더룸', 'Lounge & powder room', 'Khu nghỉ & phòng trang điểm', '休息区·化妆间', 'Dam olish va pardoz xonasi'), floor: 2 },
  ],
  hq: [
    { kind: 'office', name: L('셔틀버스 문의', 'Shuttle bus', 'Xe buýt đưa đón', '校车咨询', 'Avtobus qatnovi'), floor: 1, room: '101', tel: '570-6239' },
    { kind: 'office', name: L('등록금 납부', 'Tuition payment', 'Nộp học phí', '学费缴纳', 'Kontrakt to‘lovi'), floor: 1, room: '107', tel: '570-6242' },
  ],
  itc: [
    { kind: 'service', name: L('IT 서비스센터(웹메일·K-Cloud·Wi-Fi)', 'IT service center (mail, K-Cloud, Wi-Fi)', 'Trung tâm IT (mail, K-Cloud, Wi-Fi)', 'IT服务中心（邮箱·K-Cloud·Wi-Fi）', 'IT xizmat markazi (pochta, K-Cloud, Wi-Fi)'), floor: 3, room: '301', tel: '570-6283' },
  ],
  lab: [
    { kind: 'office', name: L('안전보건관리센터', 'Safety & health center', 'Trung tâm an toàn & sức khỏe', '安全保健管理中心', 'Xavfsizlik va salomatlik markazi'), floor: 3, room: '304', tel: '570-6337' },
  ],
  sportscenter: [
    { kind: 'sports', name: L('휘트니스센터', 'Fitness center', 'Phòng gym', '健身中心', 'Fitnes markazi'), hours: [{ days: 'monThu', open: '09:00', close: '21:00' }, { days: 'fri', open: '09:00', close: '18:00' }], tel: '570-6804', open: 'inquire' },
  ],
  union2: [
    { kind: 'service', name: L('게스트하우스', 'Guest house', 'Nhà khách', '招待所', 'Mehmonxona'), tel: '570-6766', open: 'anyone' },
  ],
  haesol: [
    { kind: 'dorm', name: L('생활관 행정실', 'Dormitory office', 'Văn phòng ký túc xá', '宿舍办公室', 'Yotoqxona ma’muriyati'), tel: '570-6471' },
    { kind: 'food', name: L('생활관 식당', 'Dormitory cafeteria', 'Nhà ăn ký túc xá', '宿舍食堂', 'Yotoqxona oshxonasi'), tel: '570-6475', open: 'anyone' },
    { kind: 'store', name: L('편의점 CU', 'CU convenience store', 'Cửa hàng tiện lợi CU', 'CU便利店', 'CU do‘koni'), floor: 1, tel: '570-6742', open: 'anyone' },
    { kind: 'dorm', name: L('해솔관 관리실', 'Haesol Hall front desk', 'Phòng quản lý Haesol', '海松馆管理室', 'Haesol navbatchi xonasi'), tel: '570-6477' },
  ],
  duta: [{ kind: 'dorm', name: L('두타관 관리실', 'Duta Hall front desk', 'Phòng quản lý Duta', '头陀馆管理室', 'Duta navbatchi xonasi'), tel: '570-6476' }],
  eonjang: [{ kind: 'dorm', name: L('언장관 관리실', 'Eonjang Hall front desk', 'Phòng quản lý Eonjang', '彦长馆管理室', 'Eonjang navbatchi xonasi'), tel: '570-6702' }],
  eng4: [{ kind: 'rest', name: L('휴게 공간', 'Lounge', 'Khu nghỉ', '休息区', 'Dam olish joyi'), floor: 1 }],
  design: [{ kind: 'rest', name: L('휴게 공간', 'Lounge', 'Khu nghỉ', '休息区', 'Dam olish joyi'), floor: 1 }],
}

const FLOOR: Record<Lang, (n: number) => string> = { ko: n => `${n}층`, en: n => `Floor ${n}`, vi: n => `Tầng ${n}`, zh: n => `${n}楼`, uz: n => `${n}-qavat` }
const ROOM: Record<Lang, (r: string) => string> = { ko: r => `${r}호`, en: r => `Room ${r}`, vi: r => `Phòng ${r}`, zh: r => `${r}室`, uz: r => `${r}-xona` }
const OUTDOOR = L('건물 밖', 'Outside', 'Ngoài trời', '室外', 'Tashqarida')
const OPEN: Record<NonNullable<Facility['open']>, L5> = {
  anyone: L('누구나 이용', 'Open to everyone', 'Mở cho mọi người', '对外开放', 'Hamma uchun ochiq'),
  inquire: L('외부인 이용은 전화 문의', 'Non-students: call to check', 'Người ngoài: gọi để hỏi', '校外人员请电话咨询', 'Tashqi shaxslar: telefon orqali so‘rang'),
}
const DAYS: Record<Days, L5> = {
  weekdays: L('월–금', 'Mon–Fri', 'T2–T6', '周一至周五', 'Du–Ju'),
  monThu: L('월–목', 'Mon–Thu', 'T2–T5', '周一至周四', 'Du–Pa'),
  fri: L('금', 'Fri', 'T6', '周五', 'Ju'),
}

/** "4층 409호"처럼 층·호를 보는 사람 언어로(층은 1 이상 정수만) */
export const whereText = (lang: Lang, floor?: number | null, room?: string | null): string =>
  [floor != null && Number.isInteger(floor) && floor > 0 ? FLOOR[lang](floor) : '', room ? ROOM[lang](room) : ''].filter(Boolean).join(' ')

export type FacilityView = { kind: FacilityKind; name: string; where: string; hours: string; tel: string; /** 외부인 이용 안내(없으면 빈 문자열) */ open: string }

/** 시설 하나를 보는 사람 언어로 */
export function facilityView(f: Facility, lang: Lang): FacilityView {
  return {
    kind: f.kind,
    name: f.name[lang],
    where: f.outdoor ? OUTDOOR[lang] : whereText(lang, f.floor, f.room),
    hours: (f.hours ?? []).map(h => `${DAYS[h.days][lang]} ${h.open}–${h.close}`).join(' · '),
    tel: f.tel ? `033-${f.tel}` : '',
    open: f.open ? OPEN[f.open][lang] : '',
  }
}

export function facilitiesFor(buildingId: string, lang: Lang): FacilityView[] {
  const list = Object.hasOwn(FACILITIES, buildingId) ? FACILITIES[buildingId] : []
  return list.map(f => facilityView(f, lang))
}

/** 모든 건물의 시설(지도 화면에 한 번에 내려 준다) */
export const allFacilities = (lang: Lang): Record<string, FacilityView[]> => Object.fromEntries(Object.keys(FACILITIES).map(id => [id, facilitiesFor(id, lang)]))

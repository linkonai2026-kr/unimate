// 삼척캠퍼스 건물 27곳 이름·별칭·좌표(학교 공식 캠퍼스맵 www.kangwon.ac.kr/campusmap 2026-10-20 조회).
// 2026-11-05 카카오 장소 검색과 대조: 21곳은 8m 이내로 같음. 정문(56m)·복합스포츠센터(27m)는 스카이뷰로 보니 공식 좌표가 건물·진입로 위라 유지.
// 제1공학관(21m)은 공식 좌표가 원형교차로 도로 위라 카카오 좌표로 바꿈. 동문·동문안내실·정문안내실은 카카오에 장소가 없음
export interface LatLng { lat: number; lng: number }
export interface Building extends LatLng { id: string; no: number; name: string; aliases: string[]; names: Record<'en' | 'vi' | 'zh' | 'uz', string> }

export const CAMPUS_CENTER: LatLng = { lat: 37.4528, lng: 129.1622 }
export const CAMPUS_GATE: LatLng = { lat: 37.4508961, lng: 129.1616512 }

// 건물 번호는 2026 대학생활 가이드북 캠퍼스 안내도와 같다(101~127)
export const BUILDINGS: Building[] = [
  { id: 'hq', no: 101, name: '대학본부', aliases: ['본부', '대학본관'], lat: 37.4521882, lng: 129.1619257, names: { en: 'University Headquarters', vi: 'Tòa Hiệu bộ', zh: '大学本部', uz: 'Universitet ma’muriyati' } },
  { id: 'itc', no: 102, name: '전산정보원', aliases: ['전산원'], lat: 37.4526053, lng: 129.1617795, names: { en: 'Computing & Information Center', vi: 'Trung tâm Thông tin Máy tính', zh: '计算机信息院', uz: 'Axborot-hisoblash markazi' } },
  { id: 'lecture', no: 103, name: '강의동', aliases: ['강의관'], lat: 37.4530977, lng: 129.1624378, names: { en: 'Lecture Hall', vi: 'Tòa Giảng đường', zh: '教学楼', uz: 'O‘quv binosi' } },
  { id: 'library', no: 104, name: '삼척도서관', aliases: ['도서관', '중앙도서관'], lat: 37.4541807, lng: 129.1623334, names: { en: 'Library', vi: 'Thư viện', zh: '图书馆', uz: 'Kutubxona' } },
  { id: 'design', no: 105, name: '조형관', aliases: ['조형학관'], lat: 37.4548175, lng: 129.1634704, names: { en: 'Design & Arts Hall', vi: 'Tòa Thiết kế Tạo hình', zh: '造型馆', uz: 'Dizayn binosi' } },
  { id: 'eastguard', no: 106, name: '동문안내실', aliases: [], lat: 37.4545349, lng: 129.1658635, names: { en: 'East Gate Info Booth', vi: 'Phòng hướng dẫn Cổng Đông', zh: '东门问讯处', uz: 'Sharqiy darvoza axborot xonasi' } },
  { id: 'eastgate', no: 107, name: '동문', aliases: [], lat: 37.4544705, lng: 129.1661837, names: { en: 'East Gate', vi: 'Cổng Đông', zh: '东门', uz: 'Sharqiy darvoza' } },
  { id: 'amphi', no: 108, name: '야외음악당', aliases: [], lat: 37.4534471, lng: 129.1669678, names: { en: 'Outdoor Amphitheater', vi: 'Sân khấu ngoài trời', zh: '露天音乐堂', uz: 'Ochiq sahna' } },
  { id: 'union2', no: 109, name: '제2학생회관', aliases: ['2학생회관', '게스트하우스'], lat: 37.4528345, lng: 129.1659896, names: { en: 'Student Union 2', vi: 'Hội quán Sinh viên 2', zh: '第二学生会馆', uz: '2-talabalar uyi' } },
  { id: 'gym', no: 110, name: '체육관', aliases: [], lat: 37.4531481, lng: 129.1655919, names: { en: 'Gymnasium', vi: 'Nhà thi đấu', zh: '体育馆', uz: 'Sport zali' } },
  { id: 'sportshall', no: 111, name: '생활체육관', aliases: [], lat: 37.4527084, lng: 129.1650029, names: { en: 'Recreation Gym', vi: 'Nhà thể thao', zh: '生活体育馆', uz: 'Ommaviy sport zali' } },
  { id: 'union', no: 112, name: '학생회관', aliases: [], lat: 37.4526071, lng: 129.1641412, names: { en: 'Student Union', vi: 'Hội quán Sinh viên', zh: '学生会馆', uz: 'Talabalar uyi' } },
  { id: 'mainguard', no: 113, name: '정문안내실', aliases: [], lat: 37.4515541, lng: 129.1616249, names: { en: 'Main Gate Info Booth', vi: 'Phòng hướng dẫn Cổng chính', zh: '正门问讯处', uz: 'Bosh darvoza axborot xonasi' } },
  { id: 'maingate', no: 114, name: '정문', aliases: [], lat: 37.4508961, lng: 129.1616512, names: { en: 'Main Gate', vi: 'Cổng chính', zh: '正门', uz: 'Bosh darvoza' } },
  { id: 'eng3', no: 115, name: '제3공학관', aliases: ['3공학관'], lat: 37.4519993, lng: 129.1609259, names: { en: 'Engineering Building 3', vi: 'Tòa Kỹ thuật 3', zh: '第三工学馆', uz: '3-muhandislik binosi' } },
  { id: 'eonjang', no: 116, name: '언장관', aliases: ['언장생활관'], lat: 37.4511035, lng: 129.1596685, names: { en: 'Eonjang Hall (Dorm)', vi: 'Ký túc xá Eonjang', zh: '彦长馆（宿舍）', uz: 'Eonjang yotoqxonasi' } },
  { id: 'startup', no: 117, name: '창업보육센터', aliases: [], lat: 37.451405, lng: 129.1589427, names: { en: 'Startup Incubation Center', vi: 'Trung tâm Ươm tạo Khởi nghiệp', zh: '创业孵化中心', uz: 'Startap inkubatsiya markazi' } },
  { id: 'eng4', no: 118, name: '제4공학관', aliases: ['4공학관'], lat: 37.4519834, lng: 129.1593322, names: { en: 'Engineering Building 4', vi: 'Tòa Kỹ thuật 4', zh: '第四工学馆', uz: '4-muhandislik binosi' } },
  { id: 'humsoc', no: 119, name: '인문사회과학관', aliases: ['인문사회관', '인사관'], lat: 37.4524251, lng: 129.1588251, names: { en: 'Humanities & Social Sciences Hall', vi: 'Tòa Khoa học Xã hội Nhân văn', zh: '人文社会科学馆', uz: 'Gumanitar va ijtimoiy fanlar binosi' } },
  { id: 'eng5', no: 120, name: '5공학관', aliases: ['제5공학관', '공5', '5공'], lat: 37.4530387, lng: 129.1592608, names: { en: 'Engineering Building 5', vi: 'Tòa Kỹ thuật 5', zh: '第五工学馆', uz: '5-muhandislik binosi' } },
  { id: 'eng1', no: 121, name: '제1공학관', aliases: ['1공학관'], lat: 37.453009, lng: 129.1608894, names: { en: 'Engineering Building 1', vi: 'Tòa Kỹ thuật 1', zh: '第一工学馆', uz: '1-muhandislik binosi' } },
  { id: 'eng2', no: 122, name: '제2공학관', aliases: ['2공학관'], lat: 37.4536173, lng: 129.1611194, names: { en: 'Engineering Building 2', vi: 'Tòa Kỹ thuật 2', zh: '第二工学馆', uz: '2-muhandislik binosi' } },
  { id: 'lab', no: 123, name: '공동실험실습관', aliases: ['공동실험관'], lat: 37.4536261, lng: 129.1601478, names: { en: 'Joint Laboratory Building', vi: 'Tòa Thí nghiệm Chung', zh: '共同实验实习馆', uz: 'Umumiy laboratoriya binosi' } },
  { id: 'haesol', no: 124, name: '해솔관', aliases: ['해솔생활관', '삼척생활관', '기숙사', '생활관'], lat: 37.4538573, lng: 129.1588324, names: { en: 'Haesol Hall (Dorm)', vi: 'Ký túc xá Haesol', zh: '海松馆（宿舍）', uz: 'Haesol yotoqxonasi' } },
  { id: 'duta', no: 125, name: '두타관', aliases: ['두타생활관'], lat: 37.454637, lng: 129.158561, names: { en: 'Duta Hall (Dorm)', vi: 'Ký túc xá Duta', zh: '头陀馆（宿舍）', uz: 'Duta yotoqxonasi' } },
  { id: 'greenenergy', no: 126, name: '그린에너지연구관', aliases: ['그린에너지관', '그린에너지 연구관'], lat: 37.4518372, lng: 129.1624015, names: { en: 'Green Energy Research Hall', vi: 'Tòa Nghiên cứu Năng lượng Xanh', zh: '绿色能源研究馆', uz: 'Yashil energiya tadqiqot binosi' } },
  { id: 'sportscenter', no: 127, name: '복합스포츠센터', aliases: ['복합 스포츠센터', '스포츠센터'], lat: 37.4536895, lng: 129.1655397, names: { en: 'Sports Complex', vi: 'Trung tâm Thể thao Tổng hợp', zh: '综合体育中心', uz: 'Sport majmuasi' } },
]

export const buildingById = (id: string | null | undefined): Building | undefined => (id ? BUILDINGS.find(b => b.id === id) : undefined)

/** 건물 이름을 보는 사람 언어로(모르는 언어는 한국어 이름) */
export const buildingName = (b: Building, lang: string): string => (lang !== 'ko' && Object.hasOwn(b.names, lang) ? b.names[lang as keyof Building['names']] : b.name)

/** 지도 핀(이름표는 보는 사람 언어) */
export const pinsFor = (lang: string) => BUILDINGS.map(b => ({ id: b.id, no: b.no, label: buildingName(b, lang), lat: b.lat, lng: b.lng }))

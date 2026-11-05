// 데모용 시드 데이터(가입자·글·댓글·시간표·강의평가)와 데모 대본 사전 번역
import { hashPassword } from '../auth/password'
import { catalogFromCourses, type CatalogCourse } from '../timetable/catalog'
import type { ParsedCourse } from '../ai'
import { SAMPLE_TIMETABLE } from '../timetable/sample'
import { CURRENT_SEM } from '../timetable/sem'
import { normalizeParsed } from '../timetable/slots'
import type { Lang, Profile, TrMap, Weekday } from '../types'
import type { MemoryData } from './memory'
import { DEFAULT_TABLE_NAME } from './types'

type L5 = Record<Lang, string>
const L = (ko: string, en: string, vi: string, zh: string, uz: string, ja: string): L5 => ({ ko, en, vi, zh, uz, ja })

/** 데모 계정 공용 비밀번호(시드 전용) */
export const DEMO_PASSWORD = 'unimate2026'

/**
 * 데모 대본 문장의 사전 번역. 원문 문장 → 6개 언어(데모 글은 AI 호출 없이 이 사전으로 번역된다).
 * 번역 API가 실패해도 무대 장면이 무너지지 않게 한다.
 */
export const DEMO_TR: Record<string, L5> = Object.fromEntries(
  [
    L('오늘 5공학관 식당 같이 갈 사람?', 'Anyone want to go to the Engineering Building 5 cafeteria today?', 'Hôm nay có ai đi ăn ở căng tin Tòa Kỹ thuật 5 cùng không?', '今天有人一起去第五工学馆食堂吗？', "Bugun 5-muhandislik binosi oshxonasiga kim boradi?", '今日、第5工学館の食堂に一緒に行く人いませんか？'),
    L('12시에 식당 앞에서 만나요. 유학생 친구들도 환영해요!', "Let's meet in front of the cafeteria at 12. International students are welcome too!", 'Gặp nhau trước căng tin lúc 12 giờ nhé. Các bạn du học sinh cũng được chào đón!', '十二点在食堂门口见。也欢迎留学生朋友们！', "Soat 12 da oshxona oldida uchrashamiz. Xorijiy talabalar ham marhamat!", '12時に食堂の前で会いましょう。留学生の皆さんも大歓迎です！'),
    L('저도 갈래요! 베트남에서 온 신입생이에요.', "I'll come too! I'm a new student from Vietnam.", 'Mình đi với! Mình là sinh viên mới từ Việt Nam.', '我也去！我是从越南来的新生。', "Men ham boraman! Vyetnamdan kelgan yangi talabaman.", '私も行きます！ベトナムから来た新入生です。'),
    L('목요일에 시간 있어요? 같이 한국어 공부하고 싶어요.', 'Are you free on Thursday? I want to study Korean together.', 'Thứ Năm bạn có rảnh không? Mình muốn học tiếng Hàn cùng bạn.', '你星期四有空吗？我想和你一起学韩语。', "Payshanba kuni bo'shmisiz? Birga koreys tilini o'rganmoqchiman.", '木曜日は空いていますか？一緒に韓国語を勉強したいです。'),
    L('좋아요! 목요일 2시에 도서관에서 봐요.', "Sounds good! See you at the library on Thursday at 2.", 'Được đó! Hẹn gặp ở thư viện lúc 2 giờ thứ Năm nhé.', '好啊！星期四两点图书馆见。', "Yaxshi! Payshanba soat 2 da kutubxonada ko'rishamiz.", 'いいですね！木曜日の2時に図書館で会いましょう。'),
    L('5공학관 근처에 인쇄할 곳 있어요?', 'Is there a place to print near Engineering Building 5?', 'Gần Tòa Kỹ thuật 5 có chỗ in tài liệu không?', '第五工学馆附近有打印的地方吗？', "5-muhandislik binosi yaqinida chop etish joyi bormi?", '第5工学館の近くに印刷できる場所はありますか？'),
  ].flatMap(row => Object.values(row).map(sentence => [sentence, row] as const)),
)

const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR

/** 필드별 6개 언어 문장 → TrMap */
function trOf(fields: Record<string, L5>): TrMap {
  const out: TrMap = {}
  for (const [field, byLang] of Object.entries(fields))
    for (const [lang, text] of Object.entries(byLang) as [Lang, string][]) (out[lang] ??= {})[field] = text
  return out
}

export function seedData(): MemoryData {
  const now = Date.now()
  const likes = (n: number) => Array.from({ length: n }, (_, i) => `seed-like-${i}`)
  const passHash = hashPassword(DEMO_PASSWORD)
  const P = (id: string, handle: string, nickname: string, nationality: string, lang: Lang): Profile =>
    ({ id, handle, nickname, nationality, lang, passHash, createdAt: now - 30 * DAY })

  const profiles = [
    P('u-minjun', 'minjun', '민준', 'KR', 'ko'),
    P('u-linh', 'linh', 'Linh', 'VN', 'vi'),
    P('u-wei', 'wei', '王伟', 'CN', 'zh'),
    P('u-aziz', 'aziz', 'Aziz', 'UZ', 'uz'),
    P('u-jiwoo', 'jiwoo', '지우', 'KR', 'ko'),
    P('u-emma', 'emma', 'Emma', 'US', 'en'),
    P('u-haeun', 'haeun', '하은', 'KR', 'ko'),
  ]

  type Seed = { id: string; board: string; author: string; anon?: boolean; ago: number; likes: number; lang: Lang; title: L5; body: L5 }
  const posts: Seed[] = [
    { id: 'p1', board: 'free', author: 'u-jiwoo', ago: 25 * MIN, likes: 3, lang: 'ko',
      title: L('5공학관 4층 콘센트 자리 몇 시에 차요?', 'When do the outlet seats on the 4th floor of Eng. Building 5 fill up?', 'Mấy giờ thì chỗ có ổ cắm ở tầng 4 Tòa Kỹ thuật 5 hết?', '第五工学馆四楼有插座的座位几点就满了？', "5-muhandislik binosi 4-qavatidagi rozetkali joylar soat nechada to'ladi?", '第5工学館4階のコンセント席は何時に埋まりますか？'),
      body: L('시험기간이라 8시에 갔는데 콘센트 자리가 다 찼어요. 다들 몇 시쯤 오세요?', 'It\'s exam season, so all the outlet seats were taken when I went at 8. What time do you usually come?', 'Đang mùa thi nên 8 giờ mình đến là chỗ có ổ cắm đã hết. Mọi người thường đến lúc mấy giờ?', '因为是考试期间，我八点去的时候有插座的位置已经满了。大家一般几点去？', "Imtihon davri bo'lgani uchun soat 8 da borsam rozetkali joylar band ekan. Hammangiz soat nechada kelasiz?", '試験期間なので8時に行ったのですが、コンセント席はもう全部埋まっていました。皆さん何時ごろ来ていますか？') },
    { id: 'p2', board: 'global', author: 'u-aziz', ago: 2 * HR, likes: 12, lang: 'uz',
      title: L('삼척에 할랄 음식 파는 곳 있나요?', 'Is there halal food in Samcheok?', 'Ở Samcheok có chỗ nào bán đồ ăn halal không?', '三陟有清真食品吗？', 'Samcheokda halol ovqat qayerda bor?', '三陟にハラール料理を食べられるお店はありますか？'),
      body: L('캠퍼스 근처에 할랄 음식 파는 곳 아시는 분 있나요?', 'Does anyone know a place near campus that serves halal food?', 'Có ai biết chỗ nào gần trường bán đồ ăn halal không?', '有人知道学校附近哪里有清真餐吗？', 'Kampus yaqinida halol taom beradigan joy bilasizlarmi?', 'キャンパス付近でハラール料理を出しているお店を知っている方はいますか？') },
    { id: 'p3', board: 'free', author: 'u-haeun', ago: 3 * HR, likes: 14, lang: 'ko',
      title: L('오늘 5공학관 식당 백반 역대급', "Today's set meal at the Eng. Building 5 cafeteria was the best ever", 'Cơm suất hôm nay ở căng tin Tòa Kỹ thuật 5 ngon nhất từ trước tới giờ', '今天第五工学馆食堂的套餐是史上最好吃的', "Bugun 5-muhandislik binosi oshxonasidagi taom eng zo'ri bo'ldi", '今日の第5工学館食堂の定食、過去最高でした'),
      body: L('닭갈비 나왔는데 진짜 맛있었어요. 12시 전에 가면 줄이 짧아요.', 'They had dakgalbi and it was really good. The line is short if you go before 12.', 'Có món gà xào cay, ngon thật sự. Đi trước 12 giờ thì hàng ngắn.', '有辣炒鸡排，真的很好吃。十二点前去排队的人少。', "Takgalbi bor edi, juda mazali. Soat 12 dan oldin borsangiz navbat qisqa.", 'タッカルビが出て、本当においしかったです。12時前に行くと列が短いですよ。') },
    { id: 'p4', board: 'info', author: 'u-minjun', ago: 5 * HR, likes: 9, lang: 'ko',
      title: L('2027학년도 전과 모집 공고 정리', 'Summary: 2027 major transfer application', 'Tóm tắt thông báo chuyển ngành năm học 2027', '2027学年转专业招生公告整理', "2027-o'quv yili mutaxassislikni o'zgartirish e'loni", '2027学年度 転科募集公告のまとめ'),
      body: L('삼척캠퍼스 전과 신청은 학사공지에서 확인하세요. 서류 마감 놓치지 마세요.', 'Check the academic notices for Samcheok Campus major transfers. Don\'t miss the document deadline.', 'Xem thông báo học vụ để biết về chuyển ngành ở cơ sở Samcheok. Đừng lỡ hạn nộp hồ sơ nhé.', '三陟校区转专业申请请查看教务通知。别错过材料截止日期。', "Samcheok kampusida mutaxassislikni o'zgartirish uchun o'quv e'lonlarini ko'ring. Hujjat muddatini o'tkazib yubormang.", '三陟キャンパスの転科申請は学事のお知らせで確認してください。書類の締切を逃さないようにしましょう。') },
    { id: 'p5', board: 'global', author: 'u-wei', ago: 1 * DAY, likes: 5, lang: 'zh',
      title: L('같이 삼척 바다 갈 사람?', 'Anyone want to go to the Samcheok beach?', 'Có ai đi biển Samcheok cùng không?', '有没有人一起去三陟海边？', "Samcheok dengiziga birga boradiganlar bormi?", '一緒に三陟の海に行く人いませんか？'),
      body: L('토요일에 바닷가 산책하고 싶은데 같이 갈 사람 있어요?', 'I want to take a walk on the beach on Saturday. Anyone want to join?', 'Thứ Bảy mình muốn đi dạo biển, có ai đi cùng không?', '周六想去海边散步，有人一起吗？', "Shanba kuni dengiz bo'yida sayr qilmoqchiman, kim boradi?", '土曜日に海辺を散歩したいのですが、一緒に行く人はいますか？') },
    { id: 'p6', board: 'fresh', author: 'u-emma', ago: 6 * HR, likes: 2, lang: 'en',
      title: L('학생증은 어디서 만들어요?', 'How do I get a student ID card?', 'Làm thẻ sinh viên ở đâu?', '学生证在哪里办？', "Talaba guvohnomasini qayerdan olsa bo'ladi?", '学生証はどこで作れますか？'),
      body: L('이번 학기에 처음 왔어요. 학생증은 어디로 가서 만들면 되나요?', 'I just arrived this semester. Where do I go to get my student ID?', 'Mình mới đến học kỳ này. Mình cần đến đâu để làm thẻ sinh viên?', '我这学期刚来。办学生证要去哪里？', "Shu semestrda keldim. Talaba guvohnomasi uchun qayerga borishim kerak?", '今学期に来たばかりです。学生証はどこに行って作ればいいですか？') },
    { id: 'p7', board: 'secret', author: 'u-haeun', anon: true, ago: 1 * DAY + 3 * HR, likes: 11, lang: 'ko',
      title: L('외국인 친구 사귀고 싶은데 말 걸기가 어려워요', "I want to make international friends but it's hard to start a conversation", 'Mình muốn kết bạn với du học sinh nhưng khó bắt chuyện quá', '想交外国朋友，但不知道怎么搭话', "Chet ellik do'st orttirmoqchiman, lekin gap boshlash qiyin", '外国人の友達を作りたいけど、話しかけるのが難しいです'),
      body: L('영어도 자신 없고... 다들 어떻게 친해졌어요?', "I'm not confident in English either... How did you all become friends?", 'Mình cũng không tự tin tiếng Anh... Mọi người làm quen thế nào vậy?', '我英语也不太好……大家都是怎么熟起来的？', "Ingliz tilim ham yaxshi emas... Siz qanday do'stlashgansiz?", '英語にも自信がなくて…みなさんはどうやって仲良くなりましたか？') },
    { id: 'p8', board: 'market', author: 'u-jiwoo', ago: 9 * HR, likes: 0, lang: 'ko',
      title: L('회로이론 전공책 팝니다', 'Selling a Circuit Theory textbook', 'Bán sách Lý thuyết mạch', '出售电路理论教材', 'Elektr zanjirlar nazariyasi kitobi sotiladi', '回路理論の専攻書を売ります'),
      body: L('1만 원, 5공학관 앞에서 직거래해요.', '10,000 won, meet in front of Eng. Building 5.', '10.000 won, giao dịch trực tiếp trước Tòa Kỹ thuật 5.', '一万韩元，在第五工学馆门口当面交易。', "10 000 von, 5-muhandislik binosi oldida uchrashamiz.", '1万ウォン、第5工学館の前で直接取引します。') },
  ]

  type CSeed = { id: string; post: string; author: string; after: number; lang: Lang; body: L5 }
  const comments: CSeed[] = [
    { id: 'c1', post: 'p1', author: 'u-wei', after: 5, lang: 'zh', body: L('저는 보통 7시 반에 가는데 자리 있어요.', 'I usually go at 7:30 and there are seats.', 'Mình thường đến lúc 7 rưỡi, vẫn còn chỗ.', '我一般七点半去，还有位子。', "Men odatda 7:30 da boraman, joy bo'ladi.", '私はいつも7時半に行きますが、席はありますよ。') },
    { id: 'c2', post: 'p1', author: 'u-minjun', after: 9, lang: 'ko', body: L('3층 창가 쪽이 덜 붐벼요.', 'The window side on the 3rd floor is less crowded.', 'Phía cửa sổ tầng 3 ít người hơn.', '三楼靠窗的地方人少一些。', "3-qavatdagi deraza tomoni kamroq gavjum.", '3階の窓側のほうが空いています。') },
    { id: 'c3', post: 'p2', author: 'u-jiwoo', after: 20, lang: 'ko', body: L('정문 앞 케밥집이 할랄 인증 받았어요!', 'The kebab place in front of the main gate is halal certified!', 'Tiệm kebab trước cổng chính có chứng nhận halal đó!', '正门前的烤肉店有清真认证！', "Bosh darvoza oldidagi kabob do'koni halol sertifikatiga ega!", '正門前のケバブ屋さんがハラール認証を取りました！') },
    { id: 'c4', post: 'p6', author: 'u-minjun', after: 15, lang: 'ko', body: L('학생회관 2층 학생지원팀에 가면 돼요.', 'Go to the Student Support Team on the 2nd floor of the Student Union.', 'Bạn đến Phòng Hỗ trợ Sinh viên ở tầng 2 Hội quán Sinh viên nhé.', '去学生会馆二楼的学生支援组就可以。', "Talabalar uyi 2-qavatidagi talabalarni qo'llab-quvvatlash bo'limiga boring.", '学生会館2階の学生支援チームに行けば大丈夫です。') },
    { id: 'c5', post: 'p7', author: 'u-emma', after: 30, lang: 'en', body: L('그냥 인사부터 해 보세요! 저희도 친구 사귀고 싶어요.', 'Just say hi! We want to make friends too.', 'Cứ chào trước đi! Bọn mình cũng muốn kết bạn mà.', '先打个招呼就好！我们也想交朋友。', "Shunchaki salom bering! Biz ham do'st orttirmoqchimiz.", 'まずは気軽に挨拶してみてください！私たちも友達を作りたいです。') },
  ]

  type K = { user: string; name: string; place: string; day: Weekday; s: number; e: number }
  const courses: K[] = [
    { user: 'u-minjun', name: '회로이론', place: '5공학관 강의실[201호]', day: 0, s: 9, e: 12 },
    { user: 'u-minjun', name: '전자기학', place: '5공학관 강의실[202호]', day: 1, s: 9, e: 12 },
    { user: 'u-minjun', name: '신호및시스템', place: '5공학관 강의실[301호]', day: 2, s: 9, e: 12 },
    { user: 'u-minjun', name: '공학수학', place: '인문사회과학관 강의실[204호]', day: 3, s: 9, e: 11 },
    { user: 'u-minjun', name: '마이크로프로세서', place: '5공학관 컴퓨터멀티미디어실[405호]', day: 4, s: 9, e: 12 },
    { user: 'u-wei', name: '한국어회화', place: '인문사회과학관 강의실[105호]', day: 0, s: 13, e: 15 },
    { user: 'u-wei', name: '한국문화의이해', place: '인문사회과학관 강의실[106호]', day: 2, s: 13, e: 15 },
    { user: 'u-wei', name: '경영학원론', place: '인문사회과학관 강의실[301호]', day: 3, s: 14, e: 17 },
    { user: 'u-aziz', name: '데이터베이스', place: '5공학관 네트워크실험실[304호]', day: 1, s: 13, e: 16 },
    { user: 'u-aziz', name: '이산수학', place: '5공학관 강의실[201호]', day: 3, s: 9, e: 12 },
    // 같은 수업 추천 데모: Aziz·Emma가 민준과 같은 분반을 듣는다
    { user: 'u-aziz', name: '회로이론', place: '5공학관 강의실[201호]', day: 0, s: 9, e: 12 },
    { user: 'u-aziz', name: '전자기학', place: '5공학관 강의실[202호]', day: 1, s: 9, e: 12 },
    { user: 'u-emma', name: '공학수학', place: '인문사회과학관 강의실[204호]', day: 3, s: 9, e: 11 },
    { user: 'u-jiwoo', name: '디지털공학', place: '5공학관 디지털인터페이스실[406호]', day: 0, s: 9, e: 13 },
    { user: 'u-jiwoo', name: '전자회로', place: '5공학관 강의실[202호]', day: 4, s: 13, e: 17 },
    { user: 'u-emma', name: '대학영어', place: '인문사회과학관 강의실[204호]', day: 2, s: 10, e: 12 },
    { user: 'u-emma', name: '실사구시의지평', place: '그린에너지연구관 국제회의장[303호]', day: 3, s: 13, e: 15 },
    { user: 'u-haeun', name: '승마', place: '인문사회과학관 레저스포츠학과강의실[105호]', day: 1, s: 10, e: 12 },
  ]

  type R = { id: string; course: string; prof: string; author: string; rating: number; fields: Record<string, string>; lang: Lang; body: L5; ago: number }
  const reviews: R[] = [
    { id: 'r1', course: '네트워크프로그래밍', prof: '김태현', author: 'u-jiwoo', rating: 5, lang: 'ko', ago: 20 * DAY,
      fields: { hw: '많음', team: '없음', grade: '보통', att: '전자출결', exam: '두 번' },
      body: L('실습 위주라 과제가 많지만 소켓 프로그래밍 제대로 배워요.', 'Lots of assignments since it is lab-focused, but you really learn socket programming.', 'Chủ yếu thực hành nên bài tập nhiều, nhưng học lập trình socket rất bài bản.', '以实验为主，作业很多，但能真正学会套接字编程。', "Amaliyotga yo'naltirilgan, topshiriqlar ko'p, lekin soket dasturlashni yaxshi o'rganasiz.", '実習中心なので課題は多いですが、ソケットプログラミングをしっかり学べます。') },
    { id: 'r2', course: '실사구시의지평', prof: '이수정', author: 'u-emma', rating: 4, lang: 'en', ago: 12 * DAY,
      fields: { hw: '보통', team: '많음', grade: '너그러움', att: '직접호명', exam: '한 번' },
      body: L('조별 토론이 많아서 한국 친구를 사귀기 좋았어요.', 'Lots of group discussions, so it was a great way to make Korean friends.', 'Thảo luận nhóm nhiều nên rất dễ kết bạn với người Hàn.', '小组讨论很多，很适合交韩国朋友。', "Guruh muhokamalari ko'p, koreys do'stlar orttirish uchun juda yaxshi.", 'グループディスカッションが多く、韓国人の友達を作るのにぴったりでした。') },
    { id: 'r3', course: '제어공학2', prof: '박정민', author: 'u-minjun', rating: 3, lang: 'ko', ago: 40 * DAY,
      fields: { hw: '보통', team: '없음', grade: '깐깐함', att: '지정좌석', exam: '두 번' },
      body: L('내용이 어렵고 진도가 빨라요. 복습 필수.', 'The content is hard and the pace is fast. Review is a must.', 'Nội dung khó và tiến độ nhanh. Nhất định phải ôn bài.', '内容难，进度快。一定要复习。', "Mavzular qiyin, sur'at tez. Takrorlash shart.", '内容が難しく、進度も速いです。復習は必須です。') },
  ]

  const at = (ago: number) => now - ago
  const catalog = seedCatalog(courses.map(c => ({ name: c.name, place: c.place, day: c.day, start: c.s * 60, end: c.e * 60 })))
  return {
    profiles,
    posts: posts.map(p => ({
      id: p.id, board: p.board, authorId: p.author, anonymous: p.anon ?? true, lang: p.lang,
      title: p.title[p.lang], body: p.body[p.lang], tr: trOf({ title: p.title, body: p.body }),
      likes: likes(p.likes), scraps: [], images: [], createdAt: at(p.ago),
    })),
    comments: comments.map(c => {
      const post = posts.find(p => p.id === c.post)!
      return {
        id: c.id, postId: c.post, parentId: null, authorId: c.author, anonymous: true, lang: c.lang,
        body: c.body[c.lang], tr: trOf({ body: c.body }), likes: [], createdAt: at(post.ago) + c.after * MIN,
      }
    }),
    courses: courses.map((c, i) => {
      const k = catalog.find(x => x.name === c.name && x.place === c.place) ?? catalog.find(x => x.name === c.name)
      return {
        id: `k${i}`, userId: c.user, tableId: `t-${c.user}`, name: c.name, place: c.place, day: c.day, start: c.s * 60, end: c.e * 60,
        ...(k ? { code: k.code, credit: k.credit, prof: k.prof } : {}),
      }
    }),
    tables: [...new Set(courses.map(c => c.user))].map(u => ({ id: `t-${u}`, userId: u, sem: CURRENT_SEM, name: DEFAULT_TABLE_NAME, primary: true, colors: {}, createdAt: now - 30 * DAY })),
    catalog,
    images: [],
    boards: [],
    reports: [],
    grades: {
      'u-minjun': [
        { name: '1학년 1학기', rows: [{ name: '공학수학1', credit: 3, grade: 'B+', major: true }, { name: '대학영어', credit: 2, grade: 'A0', major: false }, { name: '일반물리', credit: 3, grade: 'B0', major: false }] },
        { name: '1학년 2학기', rows: [{ name: '회로이론1', credit: 3, grade: 'A0', major: true }, { name: 'C프로그래밍', credit: 3, grade: 'A+', major: true }] },
      ],
    },
    friends: [['u-minjun', 'u-jiwoo'], ['u-minjun', 'u-wei']],
    // 받은 친구 요청 데모: Emma가 민준에게 요청해 둔 상태
    requests: [['u-emma', 'u-minjun']],
    messages: [
      { id: 'm1', fromId: 'u-jiwoo', toId: 'u-minjun', body: '내일 회로이론 과제 같이 할래?', lang: 'ko', tr: {}, createdAt: at(4 * HR) },
      { id: 'm2', fromId: 'u-minjun', toId: 'u-jiwoo', body: '좋아, 도서관에서 보자', lang: 'ko', tr: {}, createdAt: at(4 * HR - 5 * MIN) },
      { id: 'm3', fromId: 'u-wei', toId: 'u-minjun', body: '明天一起吃午饭吗？', lang: 'zh',
        tr: trOf({ body: L('내일 같이 점심 먹을래요?', 'Want to have lunch together tomorrow?', 'Mai đi ăn trưa cùng nhau không?', '明天一起吃午饭吗？', "Ertaga birga tushlik qilamizmi?", '明日、一緒にお昼ご飯を食べませんか？') }), createdAt: at(2 * HR) },
    ],
    reviews: reviews.map(r => ({
      id: r.id, courseName: r.course, professor: r.prof, authorId: r.author, rating: r.rating, fields: r.fields,
      lang: r.lang, body: r.body[r.lang], tr: trOf({ body: r.body }), createdAt: at(r.ago),
    })),
  }
}

// 수업 찾기에 미리 넣어 두는 개설 강좌 예시
const OFFERINGS: ParsedCourse[] = [
  { name: '제어공학2', place: '5공학관 컴퓨터멀티미디어실[405호]', day: 0, start: '10:00', end: '13:00' },
  { name: '디지털시스템설계', place: '5공학관 디지털인터페이스실[406호]', day: 0, start: '14:00', end: '17:00' },
  { name: '반도체공학', place: '5공학관 컴퓨터멀티미디어실[405호]', day: 1, start: '10:00', end: '13:00' },
  { name: '디지털통신이론및실험', place: '5공학관 네트워크실험실[304호]', day: 1, start: '14:00', end: '18:00' },
  { name: '네트워크프로그래밍', place: '5공학관 네트워크실험실[304호]', day: 2, start: '09:00', end: '13:00' },
  { name: '실사구시의지평', place: '그린에너지연구관 국제회의장[303호]', day: 2, start: '15:00', end: '17:00' },
  { name: '승마', place: '인문사회과학관 레저스포츠학과강의실[105호]', day: 4, start: '09:00', end: '11:00' },
  { name: '스키2', place: '인문사회과학관 레저스포츠학과강의실[106호]', day: 4, start: '11:00', end: '13:00' },
]

/** 수업 찾기 시드: 개설 강좌 예시·데모 캡처 과목(교수·구분 보충) + 시드 가입자 시간표 과목 */
function seedCatalog(userCourses: Parameters<typeof catalogFromCourses>[0]): CatalogCourse[] {
  const extra: Record<string, Partial<CatalogCourse>> = {
    네트워크프로그래밍: { prof: '김태현' }, 제어공학2: { prof: '박정민' }, 반도체공학: { prof: '정우성' }, 디지털시스템설계: { prof: '오세린' },
    디지털통신이론및실험: { prof: '한지우' }, 실사구시의지평: { prof: '이수정', type: 'general' }, 승마: { prof: '조현수', type: 'general' }, 스키2: { prof: '조현수', type: 'general' },
    대학영어: { prof: 'Lauren Kim', type: 'general', credit: 2 }, 한국어회화: { prof: '서다은', type: 'general' }, 한국어회화1: { prof: '서다은', type: 'general' }, 배드민턴: { prof: '조현수', type: 'general' }, 한국문화의이해: { prof: '남궁현', type: 'general' },
  }
  const fromSample = catalogFromCourses(normalizeParsed([...OFFERINGS, ...SAMPLE_TIMETABLE]).courses)
  const all = [...fromSample, ...catalogFromCourses(userCourses).filter(c => !fromSample.some(s => s.name === c.name))]
  return all.map(c => ({ ...c, ...extra[c.name] }))
}

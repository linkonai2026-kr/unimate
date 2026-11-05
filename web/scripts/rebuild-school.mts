// 공지·학식 번역 저장본을 지금 다시 만든다(크론을 기다리지 않고). 로컬 .env.local의 Supabase·Claude 키를 쓴다.
// 실행: npm run rebuild:school -- notices            공지 두 게시판(새 공지만 요약)
//       npm run rebuild:school -- notices --retitle   공지 제목을 모두 다시 번역(번역 지침을 고쳤을 때, 요약은 그대로)
//       npm run rebuild:school -- menu                메뉴 이름 번역 사전(새 이름만)
import { getCacheStore } from '../src/lib/school/cache-store'
import { buildMenu, buildNotices } from '../src/lib/school/prebuilt'

const [job, ...flags] = process.argv.slice(2)
const store = getCacheStore()
const t0 = Date.now()

if (job === 'notices') {
  for (const board of ['academic', 'general'] as const) {
    const snaps = await buildNotices(board, store, Date.now(), { retitle: flags.includes('--retitle') })
    const missing = Object.values(snaps).reduce((s, x) => s + x.missing, 0)
    console.log(`${board}: ${snaps.ko.items.length}건 × 5개 언어, 요약 못 만든 것 ${missing}개`)
  }
} else if (job === 'menu') {
  console.log((await buildMenu(store)) ? '메뉴 사전 완료' : '식단을 받지 못했어요')
} else {
  console.error('사용법: rebuild:school -- notices [--retitle] | menu')
  process.exit(1)
}
console.log(`${Math.round((Date.now() - t0) / 1000)}초`)

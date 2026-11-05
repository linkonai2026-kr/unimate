// 게시판 고정·만들기: 핀으로 홈 즐겨찾기에서 빼고 넣기, 새 게시판 만들면 바로 글쓰기 가능·다른 사람 목록에도 보임. 신고·AI 검수·경고 배너
import { test, expect } from '@playwright/test'

test('게시판 고정 해제·다시 고정, 게시판 만들기', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  const id = `b${Date.now().toString(36)}`
  await page.goto('/signup?lang=ko')
  await page.getByPlaceholder('아이디').fill(id)
  await page.getByPlaceholder('비밀번호').fill('board-pass-1')
  await page.getByPlaceholder('닉네임').fill('게시판테스터')
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.waitForURL('/')
  const fav = page.locator('section', { hasText: '즐겨찾는 게시판' })
  await expect(fav.getByRole('link', { name: /중고장터/ })).toBeVisible()

  await page.goto('/boards')
  const market = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: /중고장터/ }) })
  await market.getByRole('button', { name: '고정 해제' }).click()
  await expect(market.getByRole('button', { name: '홈에 고정' })).toBeVisible()
  await page.goto('/')
  await expect(fav.getByRole('link', { name: /자유게시판/ })).toBeVisible()
  await expect(fav.getByRole('link', { name: /중고장터/ })).toHaveCount(0)

  const name = `코딩스터디${id.slice(-4)}`
  await page.goto('/boards')
  await page.getByRole('link', { name: '게시판 만들기' }).click()
  await page.getByLabel('게시판 이름').fill(name)
  await page.getByLabel('한 줄 설명').fill('같이 알고리즘 풀어요')
  await page.getByRole('button', { name: '게시판 만들기' }).click()
  await page.waitForURL(/\/board\//)
  await expect(page.getByRole('heading', { name })).toBeVisible()

  await page.getByRole('link', { name: '글쓰기' }).click()
  await page.getByPlaceholder('제목').fill('첫 글')
  await page.locator('textarea[name=body]').fill('반가워요')
  await page.getByRole('button', { name: '등록' }).click()
  await page.waitForURL(/\/post\//)
  await expect(page.locator('article').getByRole('link', { name })).toBeVisible()

  // 만든 사람 홈에는 바로 고정, 다른 사람 게시판 탭에도 보인다
  await page.goto('/')
  await expect(fav.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  const other = await (await browser.newContext()).newPage()
  await other.goto('/login')
  await other.getByRole('button', { name: '민준' }).click()
  await other.waitForURL('/')
  await other.goto('/boards')
  await expect(other.locator('section', { hasText: '학생들이 만든 게시판' }).getByRole('link', { name: new RegExp(name) })).toBeVisible()
})

test('AI 검수: 위반 글은 가려지고 작성자에게 경고, 다른 사람 댓글 신고 접수', async ({ browser }) => {
  // 데모 계정이 경고를 받지 않게 새로 가입한 사람으로만 돈다(키가 없으면 대역 검수기가 테스트 표시어를 위반으로 본다)
  const page = await (await browser.newContext()).newPage()
  const id = `m${Date.now().toString(36)}`
  await page.goto('/signup?lang=ko')
  await page.getByPlaceholder('아이디').fill(id)
  await page.getByPlaceholder('비밀번호').fill('mod-pass-1')
  await page.getByPlaceholder('닉네임').fill('검수테스터')
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.waitForURL('/')
  await expect(page.getByTestId('sanction-banner')).toHaveCount(0)

  await page.goto('/write/free')
  await page.getByPlaceholder('제목').fill(`검수 확인 ${id}`)
  await page.locator('textarea[name=body]').fill('이 글에는 UNIMATE-MOD-TEST 표시어가 있어요')
  await page.getByRole('button', { name: '등록' }).click()
  await page.waitForURL(/\/post\//)
  // 검수는 응답 뒤에 돈다: 가려질 때까지 새로 고쳐 본다
  await expect(async () => {
    await page.reload()
    await expect(page.getByText('규칙 위반으로 가려진 글이에요')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByText('UNIMATE-MOD-TEST')).toHaveCount(0)

  // 목록·검색에서도 빠지고, 홈에 경고 배너
  await page.goto(`/search?q=${encodeURIComponent(id)}`)
  await expect(page.getByText(`검수 확인 ${id}`)).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByTestId('sanction-banner')).toContainText('경고 1/2')

  // 다른 사람 댓글 신고 → 접수 안내, 같은 댓글 다시 신고 → 이미 신고함
  await page.goto('/post/p1')
  const reportComment = page.getByRole('link', { name: /^신고: / }).first()
  await reportComment.click()
  await expect(page.getByRole('dialog')).toContainText('이 댓글을 신고할까요?')
  await page.getByRole('dialog').getByText('광고·도배').click()
  await page.getByRole('button', { name: '신고하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '신고를 받았어요' })).toBeVisible()
  await page.getByRole('link', { name: /^신고: / }).first().click()
  await page.getByRole('dialog').getByText('욕설·비하').click()
  await page.getByRole('button', { name: '신고하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '이미 신고했어요' })).toBeVisible()
  // 평범한 댓글이라 가려지지 않는다
  await expect(page.getByText('규칙 위반으로 가려진 댓글이에요')).toHaveCount(0)
})

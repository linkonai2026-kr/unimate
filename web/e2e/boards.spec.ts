// 게시판 고정·만들기: 핀으로 홈 즐겨찾기에서 빼고 넣기, 새 게시판 만들면 바로 글쓰기 가능·다른 사람 목록에도 보임
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

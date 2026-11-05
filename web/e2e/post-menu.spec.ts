// 글 "···" 메뉴(내 글: 수정·삭제, 남의 글: 신고), 게시판 탭 글쓰기 버튼 → 게시판 고르기, 만든 사람만 게시판 삭제, 프로필 미리보기 실시간 반영
import { test, expect, type Browser, type Page } from '@playwright/test'

async function signup(browser: Browser, prefix: string, nick: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  const id = `${prefix}${Date.now().toString(36)}`
  await page.goto('/signup?lang=ko')
  await page.getByPlaceholder('아이디').fill(id)
  await page.getByPlaceholder('비밀번호').fill('menu-pass-1')
  await page.getByPlaceholder('닉네임').fill(nick)
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.waitForURL('/')
  return page
}

async function demo(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByRole('button', { name }).click()
  await page.waitForURL('/')
  return page
}

test('게시판 탭 글쓰기 → 게시판 고르기, 내 글은 ··· 메뉴에서 수정·삭제, 남의 글은 신고', async ({ browser }) => {
  const page = await signup(browser, 'm', '메뉴테스터')
  await page.goto('/boards')
  await page.getByRole('link', { name: '글쓰기' }).click()
  await page.waitForURL('/write')
  await expect(page.getByText('어느 게시판에 쓸까요?')).toBeVisible()
  await page.getByRole('link', { name: /자유게시판/ }).first().click()
  await page.waitForURL(/\/write\/free/)
  const title = `메뉴 시험 ${Date.now().toString(36)}`
  await page.getByPlaceholder('제목').fill(title)
  await page.locator('textarea[name=body]').fill('처음 쓴 내용')
  await page.getByRole('button', { name: '등록' }).click()
  await page.waitForURL(/\/post\//)
  const postUrl = page.url()

  // 내 글: ··· 안에 수정·삭제만(신고 없음)
  await page.getByLabel('글 메뉴', { exact: true }).first().click()
  const menu = page.getByRole('menu', { name: '글 메뉴' })
  await expect(menu.getByRole('menuitem', { name: '수정' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '삭제' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '신고' })).toHaveCount(0)

  // 수정: 제목·본문을 바꿔 저장하면 글에 바로 보인다
  await menu.getByRole('menuitem', { name: '수정' }).click()
  await page.waitForURL(/\/edit$/)
  await expect(page.getByText('글 수정')).toBeVisible()
  await page.getByPlaceholder('제목').fill(`${title} (고침)`)
  await page.locator('textarea[name=body]').fill('고친 내용')
  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForURL(postUrl)
  await expect(page.getByRole('heading', { name: `${title} (고침)` })).toBeVisible()
  await expect(page.getByText('고친 내용')).toBeVisible()

  // 남의 글: ··· 안에 신고(수정·삭제 없음), 남의 글 수정 화면은 글로 돌려보낸다
  const other = await demo(browser, '민준')
  await other.goto(postUrl)
  await other.getByLabel('글 메뉴', { exact: true }).first().click()
  const otherMenu = other.getByRole('menu', { name: '글 메뉴' })
  await expect(otherMenu.getByRole('menuitem', { name: '신고' })).toBeVisible()
  await expect(otherMenu.getByRole('menuitem', { name: '수정' })).toHaveCount(0)
  await other.goto(`${postUrl}/edit`)
  await other.waitForURL(postUrl)

  // 삭제: 묻는 창에서 취소하면 그대로, 확인하면 게시판으로
  await page.getByLabel('글 메뉴', { exact: true }).first().click()
  page.once('dialog', d => void d.dismiss())
  await menu.getByRole('menuitem', { name: '삭제' }).click()
  await expect(page.getByRole('heading', { name: `${title} (고침)` })).toBeVisible()
  await page.reload()
  await page.getByLabel('글 메뉴', { exact: true }).first().click()
  page.once('dialog', d => void d.accept())
  await menu.getByRole('menuitem', { name: '삭제' }).click()
  await page.waitForURL(/\/board\/free/)
  await expect(page.getByText(`${title} (고침)`)).toHaveCount(0)
})

test('학생이 만든 게시판은 만든 사람만 ··· 메뉴에서 지울 수 있다', async ({ browser }) => {
  const page = await signup(browser, 'd', '게시판지기')
  const name = `지울게시판${Date.now().toString(36).slice(-4)}`
  await page.goto('/boards/new')
  await page.getByLabel('게시판 이름').fill(name)
  await page.getByRole('button', { name: '게시판 만들기' }).click()
  await page.waitForURL(/\/board\//)
  const boardUrl = page.url()

  // 다른 사람에게는 메뉴가 없다
  const other = await demo(browser, '민준')
  await other.goto(boardUrl)
  await expect(other.getByRole('heading', { name })).toBeVisible()
  await expect(other.getByLabel('게시판 메뉴', { exact: true })).toHaveCount(0)

  await page.getByLabel('게시판 메뉴', { exact: true }).first().click()
  page.once('dialog', d => void d.accept())
  await page.getByRole('menuitem', { name: '게시판 삭제' }).click()
  await page.waitForURL('/boards')
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)
  await other.goto(boardUrl)
  await expect(other.getByRole('heading', { name })).toHaveCount(0)
})

test('프로필 수정: 닉네임·학과·국적을 고치는 대로 미리보기가 바뀌고, 저장하면 다른 화면에도 바로 보인다', async ({ browser }) => {
  const page = await signup(browser, 'p', '미리보기')
  await page.goto('/me/edit')
  const preview = page.getByTestId('profile-preview')
  await expect(preview).toContainText('미리보기')
  await page.locator('input[name=nickname]').fill('바뀐이름')
  await expect(preview).toContainText('바뀐이름')
  await page.locator('input[name=major]').fill('컴퓨터공학')
  await page.locator('input[name=year]').fill('25')
  await expect(preview).toContainText('컴퓨터공학 · 25')
  await page.locator('select[name=nationality]').selectOption('VN')
  await expect(preview.getByRole('img', { name: 'VN' })).toBeVisible()

  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForURL('/me')
  await expect(page.getByText('바뀐이름').first()).toBeVisible()
})

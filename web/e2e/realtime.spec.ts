// 데모 핵심 장면: 한국어 글이 베트남 학생 화면에 베트남어로 바로 뜨고, 베트남어 댓글이 한국어로 보인다
import { test, expect, type Browser, type Page } from '@playwright/test'

async function loginAs(browser: Browser, label: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: label }).click()
  await page.waitForURL('/')
  return page
}

test('두 기기 실시간 번역', async ({ browser }) => {
  const minjun = await loginAs(browser, '민준')
  const linh = await loginAs(browser, 'Linh')
  await linh.goto('/board/free')

  await minjun.goto('/write/free')
  await minjun.getByPlaceholder('제목').fill('오늘 5공학관 식당 같이 갈 사람?')
  await minjun.locator('textarea[name=body]').fill('12시에 식당 앞에서 만나요. 유학생 친구들도 환영해요!')
  await minjun.getByRole('button', { name: '등록' }).click()
  await minjun.waitForURL(/\/post\//)

  // Linh은 새로고침 없이 베트남어 제목을 본다
  await expect(linh.getByText('Hôm nay có ai đi ăn ở căng tin Tòa Kỹ thuật 5 cùng không?').first()).toBeVisible({ timeout: 3000 })

  await linh.goto(minjun.url())
  await linh.locator('input[name=body]').fill('Mình đi với! Mình là sinh viên mới từ Việt Nam.')
  await linh.getByRole('button', { name: 'Đăng' }).click()

  // 민준의 글 상세에 한국어 댓글이 뜬다
  await expect(minjun.getByText('저도 갈래요! 베트남에서 온 신입생이에요.')).toBeVisible({ timeout: 3000 })
})

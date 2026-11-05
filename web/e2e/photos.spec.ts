// 게시판 사진: 글쓰기에서 사진 첨부 → 상세에 사진, 목록에 미리보기, 익명 표시. 로그인 없이는 사진 못 받음
import { test, expect } from '@playwright/test'
import path from 'node:path'

test('사진 첨부 글쓰기', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')
  await page.goto('/write/free')
  const title = `사진 테스트 ${Date.now()}`
  await page.getByPlaceholder('제목').fill(title)
  await page.locator('textarea[name=body]').fill('캠퍼스 사진이에요')
  await page.locator('label input[type=file]').setInputFiles(path.join(__dirname, '../public/brand/icon-512.png'))
  await expect(page.getByText('사진 1/4')).toBeVisible()
  await page.getByRole('button', { name: '등록' }).click()
  await page.waitForURL(/\/post\//)

  await expect(page.locator('article img[src^="/api/img"]').first()).toBeVisible()
  // 800px 이하로 줄여 JPEG으로 올라갔고, 실제로 그려진다(번역 뒤 화면이 다시 그려져도 되게 매번 새로 찾는다)
  const widths = () => page.evaluate(() => [...document.querySelectorAll('article img[src^="/api/img"]')].map(i => (i as HTMLImageElement).naturalWidth))
  await expect.poll(async () => (await widths())[0] ?? 0, { timeout: 5000 }).toBeGreaterThan(0)
  expect((await widths())[0]).toBeLessThanOrEqual(800)
  const src = await page.evaluate(() => document.querySelector('article img[src^="/api/img"]')!.getAttribute('src'))
  await expect(page.locator('article').getByText('익명')).toBeVisible()

  await page.goto('/board/free')
  const card = page.getByRole('link', { name: new RegExp(title) })
  await expect(card.locator('img[src^="/api/img"]')).toBeVisible()

  const res = await page.request.get(src!)
  expect(res.headers()['content-type']).toBe('image/jpeg')
})

test('로그인 없이는 사진을 받을 수 없다', async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL })
  expect((await anon.get('/api/img/anything')).status()).toBe(401)
})

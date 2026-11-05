// 방문객 모드: 로그인 없이 지도·학식·공지를 자기 언어로 보고, 학생 기능은 여전히 로그인이 필요한지 확인
import { expect, test } from '@playwright/test'

test('로그인 없이 방문객 화면을 영어로 쓰고, 학생 화면은 로그인으로 보낸다', async ({ browser }) => {
  // 정문 근처에 있는 방문객(GPS 허용)
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4512, longitude: 129.1617 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  let routeUrl = ''
  page.on('request', r => { if (r.url().includes('/api/route')) routeUrl = r.url() })

  await page.goto('/login')
  await page.getByRole('link', { name: '로그인 없이 둘러보기' }).click()
  await expect(page).toHaveURL(/\/visit\?lang=ko/, { timeout: 30_000 })

  await page.getByRole('link', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: /Welcome to Kangwon National University/ })).toBeVisible({ timeout: 30_000 })

  // 자주 찾는 곳: 건물 이름만, 누르면 로그인 없이 바로 길찾기 시작
  await page.getByRole('link', { name: 'Library', exact: true }).click()
  await expect(page).toHaveURL(/\/visit\/map\?b=library&go=1&lang=en/, { timeout: 30_000 })
  await expect.poll(() => routeUrl, { timeout: 30_000 }).toContain('to=37.4541807,129.1623334')
  expect(routeUrl).toContain('from=37.4512,129.1617')

  // 하단 탭으로 학식·공지(언어 유지). 길 안내 중에는 안내 화면이 탭을 덮으므로 첫 화면에서 이동
  await page.goto('/visit?lang=en')
  await page.getByRole('navigation').last().getByRole('link', { name: "This week's menu" }).click()
  await expect(page).toHaveURL(/\/visit\/menu\?lang=en/, { timeout: 30_000 })
  // 공지는 처음 열 때 8건을 요약하느라 오래 걸려서, 링크가 언어를 유지하는지만 본다
  await expect(page.getByRole('navigation').last().getByRole('link', { name: 'Academic notices' })).toHaveAttribute('href', '/visit/notices?lang=en')

  // 학생 기능은 그대로 로그인 필요
  await page.goto('/boards')
  await expect(page).toHaveURL(/\/login/)
})

test('로그인 없이 길찾기 API를 쓸 수 있다', async ({ request }) => {
  const res = await request.get('/api/route?from=37.4508961,129.1616512&to=37.4541807,129.1623334&lang=en')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.meters).toBeGreaterThan(0)
})

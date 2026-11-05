// 지도 둘러보기에서도 내 위치를 실시간으로: "내 위치" 버튼 → 위치·정확도 표시 → 움직이면 따라옴, 권한 거부 시 안내
import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/', { timeout: 60_000 })
}

test('둘러보기에서 내 위치 버튼을 누르면 실시간 위치와 정확도가 나온다', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4520, longitude: 129.1640, accuracy: 15 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await login(page)
  await page.goto('/map')
  // 이미 허용돼 있으면 들어오자마자 위치를 잡는다
  const status = page.getByRole('status', { name: '내 위치' })
  await expect(status).toContainText('±15m', { timeout: 15_000 })

  // 움직이면 정확도·위치가 갱신된다
  await ctx.setGeolocation({ latitude: 37.4525, longitude: 129.1630, accuracy: 40 })
  await expect(status).toContainText('±40m')

  // 버튼을 누르면 내 위치로 지도를 옮긴다(버튼이 있고 눌린다)
  await page.getByRole('button', { name: '내 위치' }).click()
  await expect(status).toContainText('±40m')
  await ctx.close()
})

test('위치 권한이 없으면 내 위치 버튼을 눌렀을 때 허용 방법을 알려 준다', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: [] })
  const page = await ctx.newPage()
  await login(page)
  await page.goto('/map')
  await expect(page.getByRole('status', { name: '내 위치' })).toHaveCount(0)
  await page.getByRole('button', { name: '내 위치' }).click()
  await expect(page.getByText('위치 권한을 허용해 주세요')).toBeVisible({ timeout: 10_000 })
  await ctx.close()
})

/** 휴대폰 방향 센서 값을 흉내 낸다(alpha는 반시계 방향, 북쪽 기준) */
async function turnPhone(page: import('@playwright/test').Page, alpha: number) {
  await page.evaluate(a => {
    const e = new Event('deviceorientationabsolute')
    Object.defineProperty(e, 'alpha', { value: a })
    Object.defineProperty(e, 'absolute', { value: true })
    window.dispatchEvent(e)
  }, alpha)
}

test('휴대폰으로 지도에 들어오면 아무것도 누르지 않아도 내 위치와 방향 부채꼴이 바로 나온다', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, geolocation: { latitude: 37.4520, longitude: 129.1640, accuracy: 12 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await login(page)
  await page.goto('/map')
  await expect(page.getByRole('status', { name: '내 위치' })).toContainText('±12m', { timeout: 15_000 })
  // 센서 값이 오면 방향 켜기 버튼 없이 부채꼴이 그 방향(360-270 = 90도, 동쪽)을 가리킨다
  await expect(async () => {
    await turnPhone(page, 270)
    await expect(page.locator('[data-cone]').first()).toHaveAttribute('style', /rotate\(90deg\)/, { timeout: 500 })
  }).toPass({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: '방향 켜기' })).toHaveCount(0)
  await ctx.close()
})

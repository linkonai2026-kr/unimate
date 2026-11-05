// 실내 지도 연결: 건물 앞(GPS 오차 범위 안)에 오면 "실내 지도로 연결합니다" → 버튼 → 1층 입구 → 엘리베이터 → "3층으로 이동" → 3층 엘리베이터 → 311호
import { test, expect } from '@playwright/test'

test('건물에 다가가면 실내 지도 연결을 묻고, 1층 입구→엘리베이터 다음 3층 엘리베이터→311호로 안내한다', async ({ browser }) => {
  // 그린에너지연구관 바로 앞
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4518372, longitude: 129.1624015, accuracy: 15 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/', { timeout: 60_000 })

  await page.goto('/map?b=greenenergy&room=311')
  const ask = page.getByRole('status').filter({ hasText: '실내 지도로 연결합니다' })
  await expect(ask).toBeVisible({ timeout: 15_000 })
  // 저절로 열리지 않고, 버튼을 눌러야 열린다
  await expect(page.getByRole('dialog', { name: /실내 안내도/ })).toHaveCount(0)
  await ask.getByRole('button', { name: '실내 지도 보기' }).click()

  const dialog = page.getByRole('dialog', { name: /실내 안내도/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('1층: 입구 → 엘리베이터')).toHaveAttribute('aria-current', 'step')
  await expect(dialog.getByText('엘리베이터로 3층')).toBeVisible()
  await expect(dialog.getByText('3층: 엘리베이터 → 311호')).toBeVisible()
  // 안내도 이미지가 아직 없어 약도로 그린다. 1층 길은 아래 입구에서 가운데 엘리베이터까지(곧은 세로선)
  await expect(dialog.getByTestId('indoor-sketch')).toBeVisible()
  await expect(dialog.getByTestId('indoor-path')).toHaveAttribute('points', '50,94 50,55')
  if (process.env.INDOOR_SHOT) await page.screenshot({ path: process.env.INDOOR_SHOT + '-1.png' })
  await expect(dialog.getByLabel('엘리베이터')).toBeVisible()

  // 3층으로 바로 넘어가 엘리베이터 → 311호
  await dialog.getByRole('button', { name: '3층으로 이동' }).click()
  await expect(dialog.getByText('3층: 엘리베이터 → 311호')).toHaveAttribute('aria-current', 'step')
  await expect(dialog.getByRole('tab', { name: '3층' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByText('311', { exact: true })).toBeVisible()
  if (process.env.INDOOR_SHOT) await page.screenshot({ path: process.env.INDOOR_SHOT + '-3.png' })
  await dialog.getByRole('button', { name: '1층 다시 보기' }).click()
  await expect(dialog.getByText('1층: 입구 → 엘리베이터')).toHaveAttribute('aria-current', 'step')

  // 실외 지도로 돌아가면 이 건물에서 멀어질 때까지 다시 묻지 않는다
  await dialog.getByRole('button', { name: '실외 지도로' }).click()
  await expect(page.getByRole('dialog', { name: /실내 안내도/ })).toHaveCount(0)
  await expect(ask).toHaveCount(0)
  await ctx.close()
})

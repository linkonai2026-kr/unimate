// 수업 찾기: 검색해서 담기 → 시간표에 블록, 겹치는 수업은 "시간 겹침"으로 막힘, 빼기
import { test, expect } from '@playwright/test'

test('수업 찾기로 담기·겹침 차단·빼기', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')

  await page.goto('/timetable/add?q=네트워크프로그래밍')
  const row = page.locator('li', { hasText: '네트워크프로그래밍' })
  // 민준은 수 09–12 신호및시스템이 있어 수 09–13 네트워크프로그래밍과 겹친다
  await expect(row.getByText('시간 겹침')).toBeVisible()

  await page.goto('/timetable/add?q=실사구시의지평')
  await page.locator('li', { hasText: '실사구시의지평' }).getByRole('button', { name: '추가' }).click()
  await expect(page.locator('li', { hasText: '실사구시의지평' }).getByRole('button', { name: '빼기' })).toBeVisible()

  await page.goto('/timetable')
  await expect(page.getByRole('link', { name: /실사구시의지평/ })).toBeVisible()

  await page.goto('/timetable/add?q=실사구시의지평')
  await page.locator('li', { hasText: '실사구시의지평' }).getByRole('button', { name: '빼기' }).click()
  await expect(page.locator('li', { hasText: '실사구시의지평' }).getByRole('button', { name: '추가' })).toBeVisible()
})

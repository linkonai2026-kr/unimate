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

test('수업을 담고 상단 뒤로를 누르면 시간표에 바로 보인다', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')

  // 시간표를 한 번 본 뒤(브라우저에 옛 화면이 남은 상태) 화면 안 링크로 수업 찾기에 들어간다
  await page.goto('/timetable')
  await expect(page.getByRole('link', { name: /실사구시의지평/ })).toHaveCount(0)
  await page.getByRole('link', { name: '수업 찾기' }).click()
  await page.waitForURL(/\/timetable\/add/)
  const row = page.locator('li', { hasText: '실사구시의지평' })
  await row.getByRole('button', { name: '추가' }).click()
  await expect(row.getByRole('button', { name: '빼기' })).toBeVisible()

  // 뒤로 한 번에 시간표로 가고, 새로 고치지 않아도 담은 수업이 보인다
  await page.getByRole('button', { name: '뒤로' }).click()
  await page.waitForURL(/\/timetable(?:\?|$)/)
  await expect(page.getByRole('link', { name: /실사구시의지평/ })).toBeVisible()

  await page.goto('/timetable/add?q=실사구시의지평')
  await page.locator('li', { hasText: '실사구시의지평' }).getByRole('button', { name: '빼기' }).click()
  await expect(page.locator('li', { hasText: '실사구시의지평' }).getByRole('button', { name: '추가' })).toBeVisible()
})

// 공강 추천에 민준이 뜨고, QR 링크로 친구 추가, 베트남어 쪽지가 민준에게 한국어로 실시간 도착
import { test, expect, type Browser } from '@playwright/test'
import path from 'node:path'

// AI 키가 없으면 가짜 인식기가 이미지 내용과 상관없이 예시 시간표(8과목)를 돌려준다. 실제 AI로 돌릴 때는 E2E_TIMETABLE_IMAGE에 시간표 캡처 경로를 넣는다
const DEMO_IMAGE = process.env.E2E_TIMETABLE_IMAGE ?? path.join(__dirname, '../public/brand/icon-192.png')

async function loginAs(browser: Browser, label: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: label }).click()
  await page.waitForURL('/')
  return page
}

test('공강 매칭·QR 친구 추가·번역 쪽지', async ({ browser }) => {
  const linh = await loginAs(browser, 'Linh')
  await linh.goto('/timetable/import')
  await linh.setInputFiles('input[type=file]', DEMO_IMAGE)
  await linh.getByRole('button', { name: 'Lưu' }).click()
  await linh.waitForURL(/\/timetable\?t=/)

  await linh.goto('/friends')
  await expect(linh.getByRole('link', { name: /민준/ }).first()).toBeVisible()

  await linh.goto('/friends/add?h=minjun')
  const add = linh.getByRole('button', { name: 'Kết bạn' })
  if (await add.isVisible()) await add.click()

  const minjun = await loginAs(browser, '민준')
  await minjun.goto('/messages/linh')

  await linh.goto('/messages/minjun')
  await linh.locator('input[name=body]').fill('Thứ Năm bạn có rảnh không? Mình muốn học tiếng Hàn cùng bạn.')
  await linh.getByRole('button', { name: 'Đăng' }).click()

  await expect(minjun.getByText('목요일에 시간 있어요? 같이 한국어 공부하고 싶어요.').last()).toBeVisible({ timeout: 3000 })
})

test('친구 요청 수락 → 새 쪽지로 친구 골라 보내기, 친구 화면의 쪽지 버튼', async ({ browser }) => {
  // Linh이 요청 → 민준 화면에 실시간으로 뜨고 수락하면 둘 다 친구
  const linh = await loginAs(browser, 'Linh')
  const minjun = await loginAs(browser, '민준')
  await minjun.goto('/friends')
  await linh.goto('/friends/add?h=minjun')
  const ask = linh.getByRole('button', { name: 'Kết bạn' })
  if (await ask.isVisible()) {
    await ask.click()
    await expect(linh.getByText('Đã gửi lời mời')).toBeVisible()
  }
  const requests = minjun.locator('section', { hasText: '받은 친구 요청' })
  await expect(requests.getByRole('link', { name: /Linh/ })).toBeVisible({ timeout: 5000 })
  await requests.getByRole('listitem').filter({ hasText: 'Linh' }).getByRole('button', { name: '수락' }).click()
  await expect(minjun.locator('section', { hasText: '내 친구' }).getByRole('link', { name: /Linh/ })).toBeVisible()

  await minjun.goto('/messages')
  await minjun.getByRole('link', { name: '새 쪽지' }).click()
  await expect(minjun.getByText('누구에게 보낼까요?')).toBeVisible()
  await minjun.getByRole('link', { name: /Linh/ }).last().click()
  await minjun.waitForURL('/messages/linh')

  await minjun.goto('/friends/linh')
  await minjun.getByRole('link', { name: '쪽지 보내기' }).click()
  await minjun.waitForURL('/messages/linh')
})

test('친구 추가 화면에 같은 수업 듣는 사람 추천', async ({ browser }) => {
  const minjun = await loginAs(browser, '민준')
  await minjun.goto('/friends')
  const section = minjun.locator('section', { hasText: '나와 같은 수업 듣는 사람' })
  await expect(section.getByRole('link', { name: /Aziz/ })).toContainText('같은 수업 2개')
  await expect(section.getByRole('link', { name: /Aziz/ })).toContainText('회로이론 · 전자기학')
  await expect(section.getByRole('link', { name: /Emma/ })).toContainText('공학수학')
})

test('거절하면 친구가 되지 않는다', async ({ browser }) => {
  const minjun = await loginAs(browser, '민준')
  await minjun.goto('/friends')
  // 데모 시드: Emma가 보낸 요청
  const row = minjun.locator('section', { hasText: '받은 친구 요청' }).getByRole('listitem').filter({ hasText: 'Emma' })
  await row.getByRole('button', { name: '거절' }).click()
  await expect(row).toHaveCount(0)
  await expect(minjun.locator('section', { hasText: '내 친구' }).getByRole('link', { name: /Emma/ })).toHaveCount(0)
})

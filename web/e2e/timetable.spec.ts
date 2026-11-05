// 시간표 캡처 업로드 → 확인 화면 → 저장 → 강의 시트에서 길찾기 링크까지(건물 이름은 사용자 언어로)
import { test, expect } from '@playwright/test'
import path from 'node:path'

// AI 키가 없으면 가짜 인식기가 이미지 내용과 상관없이 예시 시간표(8과목)를 돌려준다. 실제 AI로 돌릴 때는 E2E_TIMETABLE_IMAGE에 시간표 캡처 경로를 넣는다
const DEMO_IMAGE = process.env.E2E_TIMETABLE_IMAGE ?? path.join(__dirname, '../public/brand/icon-192.png')

test('캡처로 시간표 등록', async ({ page }) => {
  // 키가 있으면 실제 Claude가 그림을 읽어서 대역(즉시)보다 오래 걸린다
  test.setTimeout(90_000)
  await page.goto('/login?lang=ko')
  await page.getByRole('button', { name: 'Linh' }).click()
  await page.waitForURL('/')
  await page.goto('/timetable/import')
  await page.setInputFiles('input[type=file]', DEMO_IMAGE)
  await expect(page.locator('input[aria-label="Môn học"]')).toHaveCount(8, { timeout: 45_000 })
  await page.getByRole('button', { name: 'Lưu' }).click()
  await page.waitForURL(/\/timetable\?t=/)
  await page.getByRole('link', { name: /Mạng máy tính|컴퓨터네트워크/ }).first().click()
  await expect(page.getByRole('link', { name: /Chỉ đường · Tòa Kỹ thuật 5/ })).toHaveAttribute('href', '/map?b=eng5&room=304&go=1')
})

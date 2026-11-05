// 내 정보: 가입 → 프로필 수정(그림·학과·학번·언어) → 비밀번호 변경 → 새 비밀번호로 다시 로그인
import { test, expect } from '@playwright/test'
import path from 'node:path'

test('프로필 수정과 비밀번호 변경', async ({ page }) => {
  const id = `p${Date.now().toString(36)}`
  await page.goto('/signup?lang=ko')
  await page.getByPlaceholder('아이디').fill(id)
  await page.getByPlaceholder('비밀번호').fill('first-pass-1')
  await page.getByPlaceholder('닉네임').fill('테스터')
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.waitForURL('/')

  await page.goto('/me/edit')
  await page.locator('input[name=avatar][value="3"]').check({ force: true })
  await page.getByLabel('학과').fill('전자공학과')
  await page.getByLabel('학번').fill('24')
  await page.getByLabel('사용 언어').selectOption('en')
  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForURL('/me')
  await expect(page.getByText(/전자공학과 · 24/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Change password/ })).toBeVisible()

  await page.goto('/me/password')
  await page.getByPlaceholder('Current password').fill('wrong-pass')
  await page.getByPlaceholder('New password').fill('second-pass-2')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Current password is wrong')).toBeVisible()
  await page.getByPlaceholder('Current password').fill('first-pass-1')
  await page.getByPlaceholder('New password').fill('second-pass-2')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText(/Password changed/)).toBeVisible()

  await page.goto('/me')
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL(/\/login/)
  await page.getByPlaceholder('아이디').fill(id)
  await page.getByPlaceholder('비밀번호').fill('second-pass-2')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.waitForURL('/')
})

test('프로필 사진 올리기·지우기, 익명 글에는 안 보임', async ({ page }) => {
  const id = `ph${Date.now().toString(36)}`
  await page.goto('/signup?lang=ko')
  await page.getByPlaceholder('아이디').fill(id)
  await page.getByPlaceholder('비밀번호').fill('photo-pass-1')
  await page.getByPlaceholder('닉네임').fill('사진테스터')
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.waitForURL('/')

  await page.goto('/me/edit')
  await page.locator('label input[type=file]').setInputFiles(path.join(__dirname, '../public/brand/icon-512.png'))
  await expect(page.locator('img[src^="blob:"]')).toBeVisible()
  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForURL('/me')
  const photo = page.locator('main img[src^="/api/img"]').first()
  await expect(photo).toBeVisible()
  // 정사각형 400px 이하로 잘려 올라갔다
  await expect.poll(() => photo.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(await photo.evaluate(i => { const m = i as HTMLImageElement; return [m.naturalWidth <= 400, m.naturalWidth === m.naturalHeight] })).toEqual([true, true])

  // 익명 글에는 내 사진이 나오지 않는다
  await page.goto('/write/free')
  await page.getByPlaceholder('제목').fill(`사진 노출 확인 ${id}`)
  await page.locator('textarea[name=body]').fill('본문')
  await page.getByRole('button', { name: '등록' }).click()
  await page.waitForURL(/\/post\//)
  await expect(page.locator('article').getByText('익명')).toBeVisible()
  await expect(page.locator('article img[src^="/api/img"]')).toHaveCount(0)

  await page.goto('/me/edit')
  await page.getByRole('button', { name: '사진 지우기' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForURL('/me')
  await expect(page.locator('main img[src^="/api/img"]')).toHaveCount(0)
})

test('학식 화면 제목은 "내 정보"가 아니다', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')
  await page.goto('/menu')
  await expect(page.locator('header')).not.toContainText('내 정보')
})

test('가입 화면: 국적을 바꾸면 언어가 따라가고, 언어를 직접 고르면 국적을 바꿔도 지킨다', async ({ page }) => {
  await page.goto('/signup')
  const nation = page.locator('select[name="nationality"]')
  const lang = page.locator('select[name="lang"]')
  await nation.selectOption('UZ')
  await expect(lang).toHaveValue('uz')
  await lang.selectOption('zh')
  await nation.selectOption('VN')
  await expect(lang).toHaveValue('zh')
  // 위의 화면 언어 버튼을 누르면 다시 그 언어에 맞춘다
  await page.getByRole('link', { name: 'Tiếng Việt' }).click()
  await expect(nation).toHaveValue('VN')
  await expect(lang).toHaveValue('vi')
})

test('데모 계정은 한국어·중국어·베트남어 세 개이고, 국적·언어는 바꿀 수 없다', async ({ page }) => {
  await page.goto('/login')
  for (const name of ['민준', '王伟', 'Linh']) await expect(page.getByRole('button', { name })).toBeVisible()
  await page.getByRole('button', { name: '王伟' }).click()
  await page.waitForURL('/')
  await page.goto('/me/edit')
  await expect(page.locator('select[name="nationality"]')).toBeDisabled()
  await expect(page.locator('select[name="lang"]')).toBeDisabled()
  await expect(page.locator('select[name="lang"]')).toHaveValue('zh')
})

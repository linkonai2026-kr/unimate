// 실시간 GPS 길찾기: 캠퍼스 안에서 내 위치로 출발 → 안내 → 경로 이탈 시 다시 찾기 → 도착 안내
import { test, expect } from '@playwright/test'

test('GPS 위치를 따라 안내하고 도착하면 층·호수를 알려 준다', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4520, longitude: 129.1640 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')

  let routeCalls = 0
  page.on('request', r => { if (r.url().includes('/api/route')) routeCalls++ })
  await page.goto('/map?b=eng5&room=304')
  await expect(page.getByText('내 위치').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('checkbox', { name: '데모 모드' })).not.toBeChecked()
  await page.getByRole('button', { name: /안내 시작/ }).click()
  await expect(page.getByText('실시간 GPS')).toBeVisible()
  await expect(page.getByText(/m 후/)).toBeVisible()

  // 경로에서 멀리 벗어난 곳으로 이동 → 다시 찾은 경로로 계속 안내
  const before = routeCalls
  // 느린 네트워크: 다시 찾기 응답이 오는 동안 위치가 계속 바뀌게 한다
  await page.route('**/api/route**', async r => { await new Promise(res => setTimeout(res, 1500)); await r.continue() })
  await ctx.setGeolocation({ latitude: 37.4545, longitude: 129.1650 })
  await expect.poll(() => routeCalls, { timeout: 5000 }).toBeGreaterThan(before)
  // 다시 찾는 동안에도 위치가 바뀐다. 결과가 버려지지 않고 "다시 찾는 중"이 사라져야 한다
  await page.waitForTimeout(300)
  await ctx.setGeolocation({ latitude: 37.4546, longitude: 129.1651 })
  await page.waitForTimeout(300)
  await ctx.setGeolocation({ latitude: 37.4547, longitude: 129.1652 })
  await expect(page.getByText('경로를 벗어나 다시 찾는 중')).toBeHidden({ timeout: 8000 })
  await expect(page.getByText(/m 후/)).toBeVisible()

  // 5공학관 도착(학교 공식 캠퍼스맵 좌표)
  await ctx.setGeolocation({ latitude: 37.4530387, longitude: 129.1592608 })
  await expect(page.getByText('도착했어요!')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('3층 304호로 가세요')).toBeVisible()
})

// 2026-11-05 방문객 모드로 로그인 없이도 쓰게 바꿈(IP당 10분 30회 제한은 tests/visit.test.ts). 좌표 검사는 그대로
test('경로 API는 로그인 없이도 잘못된 좌표를 거절한다', async ({ request }) => {
  const res = await request.get('/api/route?from=abc&to=37.453,129.159')
  expect(res.status()).toBe(400)
})

test('시간표에서 수업을 눌러 길찾기 → 내 GPS 위치에서 바로 안내 시작', async ({ browser }) => {
  // 캠퍼스 밖(삼척 시내)에서도 정문이 아니라 내 위치에서 출발해야 한다
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4400, longitude: 129.1650 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')
  let routeUrl = ''
  page.on('request', r => { if (r.url().includes('/api/route')) routeUrl = r.url() })
  await page.goto('/timetable')
  await page.getByRole('link', { name: /마이크로프로세서/ }).click()
  await page.getByRole('link', { name: /길찾기/ }).click()
  await expect(page.getByText('실시간 GPS')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/m 후/)).toBeVisible()
  expect(routeUrl).toContain('from=37.44,129.165')
})

test('지도에서 건물을 누르면 건물 안 시설·운영시간·전화가 나온다', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')
  await page.goto('/map')
  // Leaflet·카카오맵 둘 다 점에 건물 이름이 붙어 있다(멀리서는 이름표가 숨어도 점은 누를 수 있다)
  await page.getByRole('button', { name: '그린에너지연구관', exact: true }).click()
  await expect(page.getByText('건물 안 시설')).toBeVisible()
  await expect(page.getByText('학생증 발급')).toBeVisible()
  await expect(page.getByText('월–금 09:00–18:00').first()).toBeVisible()
  await expect(page.getByRole('link', { name: '학생증 발급 033-570-6462' })).toHaveAttribute('href', 'tel:033-570-6462')
})

test('홈 다음 수업 카드에 강의실 위치·작은 지도·길찾기가 나온다(오늘 수업이 끝났어도 다음 수업)', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '민준' }).click()
  await page.waitForURL('/')
  // 민준은 평일마다 수업이 있어서 요일·시간과 상관없이 늘 다음 수업이 있다(5공학관 또는 인문사회과학관)
  const route = page.getByRole('link', { name: '길찾기', exact: true })
  await expect(route).toHaveAttribute('href', /^\/map\?b=(eng5|humsoc)&room=\d+/)
  await expect(page.locator('section').first().locator('img[src*="World_Imagery"]').first()).toBeVisible()
  await expect(page.locator('section').first().getByText(/\d층 \d+호/)).toBeVisible()
})

test('시간표가 없어도 홈의 자주 찾는 곳을 누르면 바로 길찾기가 시작된다', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Linh' }).click()
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { name: /Địa điểm hay tìm/ })).toBeVisible()
  let routeUrl = ''
  page.on('request', r => { if (r.url().includes('/api/route')) routeUrl = r.url() })
  await page.getByRole('link', { name: 'Thư viện', exact: true }).click()
  await page.waitForURL(/\/map\?b=library&go=1/)
  await expect.poll(() => routeUrl, { timeout: 30_000 }).toContain('to=')
})

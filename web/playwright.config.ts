// 브라우저 테스트 설정: 모바일 화면 크기로 개발 서버(기본 3100 포트)에 붙는다
import { defineConfig } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

// 이미 떠 있는 개발 서버가 있으면 E2E_URL로 그 주소를 쓴다(Next는 한 폴더에 dev 서버 하나만 허용)
const url = process.env.E2E_URL ?? 'http://localhost:3100'

export default defineConfig({
  testDir: 'e2e',
  testIgnore: '**/._*',
  // exFAT 볼륨에서는 ._ 파일 때문에 결과 폴더 정리가 실패해서 임시 디렉터리를 쓴다
  outputDir: path.join(os.tmpdir(), 'unimate-playwright'),
  timeout: 30_000,
  // 테스트끼리 같은 데모 계정과 메모리 저장소를 공유하므로 순서대로 돈다
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: url, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- -p 3100', url: `${url}/login`, reuseExistingServer: true, timeout: 120_000 },
})

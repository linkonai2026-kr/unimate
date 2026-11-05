// 단위 테스트 설정: tests/의 *.test.ts만 실행하고 @/ 경로를 src로 잇는다
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/._*', 'node_modules/**'],
    // 테스트는 항상 대역(메모리 저장소·가짜 AI)으로 돈다. 셸에 남은 외부 키가 실서비스를 건드리지 않게 비운다
    env: {
      ANTHROPIC_API_KEY: '',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      TMAP_APP_KEY: '',
      KAKAO_MAP_JS_KEY: '',
    },
  },
})

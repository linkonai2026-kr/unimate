# 저장소에서 작업하기

앱 명령은 `web`에서 실행한다. 스크립트는 `web/package.json`에 있다.

- 페이지와 API: `web/src/app` (로그인 뒤 화면은 `(tabs)`, 방문객 화면은 `visit`, 서버 액션은 `*-actions.ts`)
- 도메인 로직: `web/src/lib` (저장소 `store`, 인증 `auth`, 학교 데이터 `school`, 지도 `map`, 시간표 `timetable`, AI `ai`, 검수·제재 `moderation.ts`)
- 테스트: 단위 `web/tests`, 브라우저 `web/e2e`

규칙:

- 저장소 기능을 바꾸면 `web/src/lib/store/types.ts`의 `Store`와 `memory.ts`, `supabase.ts`를 함께 고치고 `web/supabase/schema.sql`을 맞춘다. `tests/store.test.ts`는 두 구현에 같은 시험을 돌린다.
- 외부 서비스 연결 조건은 `web/src/lib/env.ts`와 해당 서비스 모듈을 함께 확인한다.
- 화면 문구는 `web/src/lib/i18n.ts`에 다섯 언어(ko, en, vi, zh, uz)를 모두 넣는다.
- 날짜·요일 계산은 한국 시간 기준이다. 서버는 UTC에서 돌 수 있다.
- 로그인 검사는 `web/src/proxy.ts`가 하고, 공개 경로(`/login`, `/signup`, `/visit`, `/api`)는 각 라우트가 스스로 권한을 확인한다.
- 바꾼 뒤에는 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`를 돌린다. 브라우저 테스트 서버와 기본 포트는 `web/playwright.config.ts`를 따른다.
- `web/.env.local`과 `web/public`의 로고·아이콘은 바꾸지 않는다.

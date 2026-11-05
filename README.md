# Unimate

Unimate는 강원대학교 삼척캠퍼스용 웹 앱이다. 학교 공지, 식단, 캠퍼스 지도와 길찾기를 보여 주고, 로그인한 학생에게는 게시판, 시간표, 학점계산기, 강의평가, 친구, 쪽지를 제공한다. 화면 언어는 한국어, 영어, 베트남어, 중국어, 우즈베크어다. 글·댓글·쪽지는 AI로 번역된다.

로그인하지 않은 방문객은 `/visit`에서 언어를 고른 뒤 지도, 공지, 식단을 쓸 수 있다.

## 실행

```sh
cd web
npm ci
npm run dev -- -p 3100
```

브라우저에서 `http://localhost:3100`을 연다.

## 명령 (`web/package.json`)

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드와 실행 |
| `npm run typecheck` | 라우트 타입 생성(`next typegen`) 뒤 `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest 단위 테스트(`web/tests`) |
| `npm run e2e` | Playwright 브라우저 테스트(`web/e2e`, 기본 주소 `http://localhost:3100`, `E2E_URL`로 변경) |
| `npm run seed:supabase` / `npm run reset:supabase` | Supabase 데모 데이터 넣기 / 데모 상태로 되돌리기 |
| `npm run snapshots` | `tests/fixtures`의 HTML로 공지 저장본 JSON 다시 만들기 |

Vitest는 외부 키를 비운 채로 돌아서 항상 메모리 저장소와 가짜 AI를 쓴다. 브라우저 테스트를 실제 서비스 없이 돌리려면 외부 키를 비운 환경에서 빌드한 서버에 `E2E_URL`을 붙인다. AI 키 없이 도는 시간표 캡처 테스트는 앱 아이콘 이미지를 올리고, 가짜 인식기가 예시 시간표를 돌려준다. 실제 AI로 돌릴 때는 `E2E_TIMETABLE_IMAGE`에 시간표 캡처 경로를 넣는다.

## 환경 변수 (`web/.env.local`, 예시는 `web/.env.example`)

비어 있는 항목은 대역으로 동작한다. 판단 기준은 `web/src/lib/env.ts`에 있다.

| 변수 | 쓰임 | 비었을 때 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 번역, 공지 요약, 시간표 캡처 인식, 게시물 검수 | 데모 문장 사전과 키워드 검수기 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 서버 저장소 | 프로세스 메모리 저장소(시드 데이터) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 실시간 갱신 채널 | 서버의 SSE(`/api/live`) |
| `TMAP_APP_KEY` | 도보 경로 | 직선 경로 |
| `KAKAO_MAP_JS_KEY` | 카카오맵 | Leaflet 지도 |
| `SESSION_SECRET` | 세션 쿠키 서명 | 개발용 기본값(프로덕션에서는 필수) |
| `DEMO_LOGIN` | `1`이면 Supabase 저장소를 쓸 때도 로그인 화면에 데모 계정 버튼 표시 | 메모리 저장소일 때만 표시 |

## Supabase

`web/supabase/schema.sql`은 테이블, 인덱스, 원자적 처리 함수(공감·스크랩 토글, 시간표 교체, 위반 처리)를 만든다. 여러 번 실행해도 된다. 신고·검수·제재 부분은 파일 끝 블록에 모여 있다. 공지 마감 할 일 표는 `web/supabase/notice-tasks.sql`로 만든다.

## 학교 데이터

- 식단은 요청마다 학교 사이트에서 한국 시간 기준 이번 주(토요일에는 다음 주)를 받아 온다. 실패하면 한 번 다시 시도하고, 그래도 실패하면 오류 안내와 다시 시도 버튼을 보여 준다.
- 공지는 한국 날짜별로 10분 동안 캐시하고, 학교 사이트에 닿지 않으면 저장본(`web/src/lib/school/snapshot/notices.json`)을 출처 표시와 함께 보여 준다.
- 홈·식단·공지 화면은 한국 시간 자정이 지나거나 탭으로 돌아왔을 때 날짜가 바뀌었으면 스스로 새로고침하고, 보이는 동안 30분마다 갱신한다.

## 신고와 자동 제재

- 남의 글과 댓글을 사유를 골라 신고할 수 있다. 같은 항목은 한 번만 신고된다.
- 새 글·댓글과 신고된 항목은 AI가 이용규칙(`web/src/lib/moderation.ts`)으로 검수한다. 위반이면 항목을 가리고 작성자의 위반 횟수를 올린다.
- 1·2번째 위반은 경고, 3번째는 7일, 4번째부터는 30일 동안 글·댓글·쪽지를 쓸 수 없다. AI가 실패하면 제재하지 않는다.

## 배포

`web/.vercel/project.json`이 Vercel 프로젝트 `unimate`에 연결되어 있다. `web`에서 `npx vercel deploy --prod`로 배포하고, 프로젝트 도메인은 `unimate-campus.vercel.app`이다. 프로젝트의 함수 지역은 서울(`icn1`)이다.

## 그 밖의 폴더

- `deliverables/measure`: 공지 읽기 측정 도구([설명](deliverables/measure/README.md))

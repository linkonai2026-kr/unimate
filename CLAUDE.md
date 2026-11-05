# 저장소에서 작업하기

앱 명령은 `web`에서 실행한다. 실행과 검증 스크립트는 `web/package.json`에 있다. 페이지와 API는 `web/src/app`, 도메인 로직은 `web/src/lib`, 단위 테스트는 `web/tests`, 브라우저 테스트는 `web/e2e`에 있다.

외부 서비스 연결 조건을 바꾸는 작업은 `web/src/lib/env.ts`와 해당 서비스 모듈을 함께 확인한다. E2E 서버와 기본 포트는 `web/playwright.config.ts`를 기준으로 한다.

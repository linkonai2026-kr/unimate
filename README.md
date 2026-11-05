# Unimate

Unimate는 강원대학교 삼척캠퍼스의 공지, 식단, 지도와 학생 커뮤니티를 제공하는 웹 앱이다. 로그인한 사용자는 게시판, 시간표, 강의평가, 친구, 쪽지를 사용할 수 있다. 화면 언어는 한국어, 영어, 베트남어, 중국어, 우즈베크어다.

로그인 없이 `/visit`에서 언어를 고르고 지도, 공지, 식단을 이용할 수 있다.

```sh
cd web
npm ci
npm run dev -- -p 3100
```

브라우저에서 `http://localhost:3100`을 연다. [웹 앱 구성](web/README.md)과 [공지 읽기 측정 도구](deliverables/measure/README.md)는 각각 해당 디렉터리에서 확인할 수 있다.

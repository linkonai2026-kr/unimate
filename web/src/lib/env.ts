// 어떤 외부 서비스가 진짜로 연결됐고 어떤 것이 대역인지 판단(읽을 때마다 환경 변수 확인)
const set = (v: string | undefined): boolean => Boolean(v?.trim())

export const has = {
  get ai() { return set(process.env.ANTHROPIC_API_KEY) },
  get db() { return set(process.env.SUPABASE_URL) && set(process.env.SUPABASE_SERVICE_ROLE_KEY) },
  get tmap() { return set(process.env.TMAP_APP_KEY) },
  /** 카카오맵 JavaScript 키(공개 키라 브라우저로 내려도 된다. 카카오 개발자 콘솔에 도메인 등록 필요) */
  get kakao() { return set(process.env.KAKAO_MAP_JS_KEY) },
}

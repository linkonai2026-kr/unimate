// 방문객 모드(로그인 없이 교직원·지역 주민·방문객이 쓰는 화면) 공통: 언어를 유지하는 주소, 자주 찾는 곳
import type { Lang } from './i18n'

/** 방문객 화면 주소. 로그인이 없어서 언어는 늘 ?lang=으로 들고 다닌다(빈 값은 빼고, lang은 항상 마지막) */
export function visitHref(path: string, lang: Lang, query: Record<string, string | undefined> = {}): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (k !== 'lang' && v) sp.set(k, v)
  sp.set('lang', lang)
  return `${path}?${sp}`
}

/** 방문객이 자주 찾는 곳(행사·면접·민원·운동): 정문안내실, 대학본부, 도서관, 학생회관(식당), 복합스포츠센터 */
export const POPULAR = ['mainguard', 'hq', 'library', 'union', 'sportscenter'] as const

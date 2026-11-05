// 학기 목록과 이번 학기(한국 시간 기준. 수강신청이 열리는 2월·8월부터 다음 학기로 넘어간다), 학기·시간표 기본 이름의 화면 언어 표시
import { t, type Lang } from '../i18n'

const KST_OFFSET = 9 * 3600_000

/** 날짜가 속한 학기: 2~7월은 그해 1학기, 8~12월은 그해 2학기, 1월은 지난해 2학기 */
export function semesterOf(now: Date = new Date()): { year: number; term: 1 | 2 } {
  const kst = new Date(now.getTime() + KST_OFFSET)
  const year = kst.getUTCFullYear(), month = kst.getUTCMonth() + 1
  if (month >= 8) return { year, term: 2 }
  if (month >= 2) return { year, term: 1 }
  return { year: year - 1, term: 2 }
}

/** 이번 학기부터 거슬러 올라간 네 학기(예: "2026년 2학기") */
export function semesters(now: Date = new Date()): string[] {
  let { year, term } = semesterOf(now)
  const out: string[] = []
  for (let i = 0; i < 4; i++) {
    out.push(`${year}년 ${term}학기`)
    if (term === 2) term = 1
    else { term = 2; year-- }
  }
  return out
}

/** 서버가 뜰 때 정한다(스토어의 "이번 학기 기본 시간표"와 같은 값을 써야 하므로 상수로 둔다) */
export const SEMS = semesters()
export const CURRENT_SEM = SEMS[0]

/** 저장된 한국어 학기 값("2026년 2학기")을 화면 언어로. 모르는 모양이면 그대로 */
export function semLabel(sem: string, lang: Lang): string {
  const m = /^(\d{4})년 ([12])학기$/.exec(sem)
  return m ? t(lang, 'semYearTerm', { y: m[1], n: m[2] }) : sem
}

/** 학점계산기의 기본 학기 이름("1학년 1학기")을 화면 언어로. 사용자가 바꾼 이름은 그대로 */
export function gradeSemLabel(name: string, lang: Lang): string {
  const m = /^([1-6])학년 ([12])학기$/.exec(name)
  return m ? t(lang, 'gradeYearTerm', { y: m[1], n: m[2] }) : name
}

/** 자동으로 붙인 시간표 이름("시간표 1")을 화면 언어로. 사용자가 지은 이름은 그대로 */
export function tableLabel(name: string, lang: Lang): string {
  const m = /^시간표 (\d{1,2})$/.exec(name)
  return m ? t(lang, 'tableN', { n: m[1] }) : name
}

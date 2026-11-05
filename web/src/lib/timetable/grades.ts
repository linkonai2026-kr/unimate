// 학점계산기: 4.5 만점 평점(전체·전공)과 취득 학점
export const GRADES: Readonly<Record<string, number | null>> = { 'A+': 4.5, A0: 4, 'B+': 3.5, B0: 3, 'C+': 2.5, C0: 2, 'D+': 1.5, D0: 1, F: 0, P: null, NP: null }
export type GradeRow = { name: string; credit: number; grade: string; major: boolean }
export type GradeSemester = { name: string; rows: GradeRow[] }

/** 저장 한도(학기 수·학기당 과목 수·과목 학점) */
export const MAX_SEMS = 16
export const MAX_ROWS = 15
export const MAX_CREDIT = 6

/** 성적표에 있는 등급인지(`in`과 달리 "constructor" 같은 상속 속성은 거른다) */
export const isGrade = (g: unknown): g is string => typeof g === 'string' && Object.hasOwn(GRADES, g)

const creditOf = (r: GradeRow) => {
  const n = Number(r.credit)
  return Number.isFinite(n) && n > 0 ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100

export function gpa(sems: GradeSemester[]): { avg: number; majorAvg: number; credits: number } {
  const rows = sems.flatMap(s => s?.rows ?? []).filter(r => r && isGrade(r.grade) && creditOf(r) > 0)
  const avg = (list: GradeRow[]) => {
    // P/NP는 평점에서 빠진다
    const scored = list.filter(r => GRADES[r.grade] != null)
    const cr = scored.reduce((n, r) => n + creditOf(r), 0)
    return cr ? round2(scored.reduce((n, r) => n + creditOf(r) * GRADES[r.grade]!, 0) / cr) : 0
  }
  // 취득 학점: F·NP는 못 딴 학점
  const credits = round2(rows.filter(r => r.grade !== 'F' && r.grade !== 'NP').reduce((n, r) => n + creditOf(r), 0))
  return { avg: avg(rows), majorAvg: avg(rows.filter(r => r.major)), credits }
}

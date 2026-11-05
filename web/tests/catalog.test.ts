// 수업 찾기 필터, 시간 겹침, 학점계산기 계산 테스트
import { describe, it, expect } from 'vitest'
import { clash, filterCatalog, catalogFromCourses, type CatalogCourse } from '@/lib/timetable/catalog'
import { gpa } from '@/lib/timetable/grades'

const C = (code: string, over: Partial<CatalogCourse> = {}): CatalogCourse => ({ code, name: code, prof: '김교수', credit: 3, type: 'major', place: '5공학관 강의실[201호]', slots: [{ day: 0, start: 540, end: 720 }], ...over })
const catalog = [
  C('A'),
  C('B', { name: '대학영어', prof: 'Lauren', credit: 2, type: 'general', slots: [{ day: 2, start: 600, end: 720 }] }),
  C('C', { credit: 1, slots: [{ day: 0, start: 660, end: 780 }] }),
]

describe('clash', () => {
  it('같은 요일 시간이 겹치면 true, 맞닿기만 하면 false', () => {
    expect(clash([{ day: 0, start: 540, end: 720 }], [{ day: 0, start: 660, end: 780 }])).toBe(true)
    expect(clash([{ day: 0, start: 540, end: 720 }], [{ day: 0, start: 720, end: 780 }])).toBe(false)
    expect(clash([{ day: 0, start: 540, end: 720 }], [{ day: 1, start: 540, end: 720 }])).toBe(false)
  })
})

describe('filterCatalog', () => {
  it('과목명·교수명·코드로 찾는다(대소문자 무시)', () => {
    expect(filterCatalog(catalog, { q: 'lauren' }, []).map(c => c.code)).toEqual(['B'])
    expect(filterCatalog(catalog, { q: '대학' }, []).map(c => c.code)).toEqual(['B'])
  })
  it('구분·학점·요일 필터', () => {
    expect(filterCatalog(catalog, { type: 'general' }, []).map(c => c.code)).toEqual(['B'])
    expect(filterCatalog(catalog, { credit: 1 }, []).map(c => c.code)).toEqual(['C'])
    expect(filterCatalog(catalog, { day: 2 }, []).map(c => c.code)).toEqual(['B'])
  })
  it('겹치는 수업 숨기기: 이미 담은 수업은 남긴다', () => {
    const mine = [{ code: 'A', day: 0, start: 540, end: 720 }]
    expect(filterCatalog(catalog, { hideClash: true }, mine).map(c => c.code)).toEqual(['A', 'B'])
  })
})

describe('catalogFromCourses', () => {
  it('사용자 시간표 강의를 과목 단위로 묶고 주당 시간으로 학점을 짐작한다', () => {
    const list = catalogFromCourses([
      { name: '제어공학2', place: '5공학관[405호]', day: 0, start: 600, end: 780 },
      { name: '제어공학2', place: '5공학관[405호]', day: 2, start: 600, end: 660 },
      { name: '승마', place: '인문사회과학관[105호]', day: 4, start: 540, end: 660 },
    ])
    expect(list.map(c => [c.name, c.slots.length, c.credit])).toEqual([['제어공학2', 2, 3], ['승마', 1, 2]])
    expect(new Set(list.map(c => c.code)).size).toBe(2)
  })
  it('여러 사람이 올린 같은 분반의 같은 칸은 한 번만 담는다', () => {
    const slot = { name: '회로이론', place: '5공학관 강의실[201호]', day: 0, start: 540, end: 720 }
    const [c] = catalogFromCourses([slot, { ...slot }])
    expect(c.slots).toEqual([{ day: 0, start: 540, end: 720 }])
    expect(c.credit).toBe(3)
  })
})

describe('gpa', () => {
  it('전체·전공 평점과 취득 학점, P/NP는 평점에서 빠지고 학점에는 P만 들어간다', () => {
    const r = gpa([{ name: '1-1', rows: [
      { name: 'a', credit: 3, grade: 'A+', major: true },
      { name: 'b', credit: 3, grade: 'B0', major: false },
      { name: 'c', credit: 1, grade: 'P', major: false },
      { name: 'd', credit: 2, grade: 'NP', major: false },
      { name: 'e', credit: 3, grade: 'F', major: true },
    ] }])
    expect(r.avg).toBe(2.5)
    expect(r.majorAvg).toBe(2.25)
    expect(r.credits).toBe(7)
  })
  it('빈 입력은 0', () => expect(gpa([])).toEqual({ avg: 0, majorAvg: 0, credits: 0 }))
})

describe('gpa 예외 입력', () => {
  it('상속 속성 이름("constructor")·없는 등급은 빼서 NaN이 되지 않는다', async () => {
    const { isGrade } = await import('@/lib/timetable/grades')
    expect(isGrade('constructor')).toBe(false)
    expect(isGrade('toString')).toBe(false)
    expect(isGrade('A+')).toBe(true)
    const r = gpa([{ name: '1-1', rows: [
      { name: 'a', credit: 3, grade: 'constructor', major: true },
      { name: 'b', credit: 3, grade: 'A0', major: true },
    ] }])
    expect(r).toEqual({ avg: 4, majorAvg: 4, credits: 3 })
  })
  it('문자열·NaN·음수 학점: 숫자로 바꾸고 잘못된 값은 0학점', () => {
    const r = gpa([{ name: '1-1', rows: [
      { name: 'a', credit: '3' as unknown as number, grade: 'B0', major: false },
      { name: 'b', credit: NaN, grade: 'A+', major: false },
      { name: 'c', credit: -2, grade: 'A+', major: false },
    ] }])
    expect(r).toEqual({ avg: 3, majorAvg: 0, credits: 3 })
  })
  it('P만 있으면 평점 0, 학점은 센다', () => {
    expect(gpa([{ name: 's', rows: [{ name: 'p', credit: 1, grade: 'P', major: false }] }])).toEqual({ avg: 0, majorAvg: 0, credits: 1 })
  })
})

describe('직접 일정 코드', () => {
  it('my- 앞머리만 직접 일정', async () => {
    const { isCustomCode, CUSTOM_PREFIX } = await import('@/lib/timetable/catalog')
    expect(isCustomCode(`${CUSTOM_PREFIX}abc`)).toBe(true)
    expect(isCustomCode('CS201')).toBe(false)
    expect(isCustomCode(undefined)).toBe(false)
  })
})

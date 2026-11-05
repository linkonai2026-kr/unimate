// 건물 안 시설(가이드북) 데이터를 보는 사람 언어로 바꾸는 테스트
import { describe, it, expect } from 'vitest'
import { FACILITIES, allFacilities, facilitiesFor, whereText } from '@/lib/map/facilities'
import { BUILDINGS, buildingName, pinsFor } from '@/lib/map/buildings'

describe('건물 안 시설', () => {
  it('학생증 발급은 그린에너지연구관 4층 409호, 전화는 033 지역번호를 붙인 링크용 번호', () => {
    const f = facilitiesFor('greenenergy', 'ko').find(x => x.name === '학생증 발급')
    expect(f).toMatchObject({ where: '4층 409호', tel: '033-570-6462' })
  })
  it('다른 언어로는 이름·위치·요일이 번역된다', () => {
    const vi = facilitiesFor('greenenergy', 'vi').find(x => x.tel === '033-570-6222' && x.kind === 'health')
    expect(vi).toMatchObject({ name: 'Phòng y tế', where: 'Tầng 2', hours: 'T2–T6 09:00–18:00' })
    expect(facilitiesFor('greenenergy', 'en').find(x => x.kind === 'health')?.hours).toBe('Mon–Fri 09:00–18:00')
  })
  it('시간이 여러 개면 모두 보여 준다', () => {
    expect(facilitiesFor('sportscenter', 'ko').find(x => x.kind === 'sports')?.hours).toBe('월–목 09:00–21:00 · 금 09:00–18:00')
  })
  it('모르는 건물은 빈 목록(객체 기본 속성 이름도)', () => {
    expect(facilitiesFor('nowhere', 'ko')).toEqual([])
    expect(facilitiesFor('constructor', 'ko')).toEqual([])
    expect(facilitiesFor('__proto__', 'ko')).toEqual([])
  })
  it('층은 1 이상 정수만 보여 준다', () => {
    expect(whereText('ko', 4, '409')).toBe('4층 409호')
    expect(whereText('ko', 0, '409')).toBe('409호')
    expect(whereText('en', NaN, null)).toBe('')
  })
  it('지도용 전체 시설 표, 건물 이름은 보는 사람 언어(모르는 언어는 한국어)', () => {
    expect(allFacilities('en').greenenergy.length).toBeGreaterThan(0)
    const hq = BUILDINGS.find(b => b.id === 'hq')!
    expect(buildingName(hq, 'en')).toBe('University Headquarters')
    expect(buildingName(hq, 'constructor')).toBe('대학본부')
    expect(pinsFor('vi').find(p => p.id === 'hq')?.label).toBe('Tòa Hiệu bộ')
  })
  it('모든 시설은 있는 건물에 붙어 있고 6개 언어 이름이 다 있다', () => {
    for (const [id, list] of Object.entries(FACILITIES)) {
      expect(BUILDINGS.some(b => b.id === id)).toBe(true)
      for (const f of list) for (const l of ['ko', 'en', 'vi', 'zh', 'uz', 'ja'] as const) expect(f.name[l]).toBeTruthy()
    }
  })
})

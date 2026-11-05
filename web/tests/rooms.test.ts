// 에브리타임 강의실 표기에서 건물·호수·층을 뽑는 테스트
import { describe, it, expect } from 'vitest'
import { parsePlace } from '@/lib/timetable/rooms'

describe('parsePlace', () => {
  it('5공학관 405호', () => {
    expect(parsePlace('5공학관 컴퓨터멀티미디어실[405호]')).toEqual({ buildingId: 'eng5', roomNo: '405', floor: 4 })
  })
  it('인문사회과학관 105호는 1층', () => {
    expect(parsePlace('인문사회과학관 레저스포츠학과강의실[105호]')).toMatchObject({ buildingId: 'humsoc', floor: 1 })
  })
  it('그린에너지연구관', () => {
    expect(parsePlace('그린에너지연구관 국제회의장[303호]').buildingId).toBe('greenenergy')
  })
  it('가이드북 건물 이름(제N공학관·생활관)도 알아본다', () => {
    expect(parsePlace('제2공학관 강의실[301호]')).toMatchObject({ buildingId: 'eng2', floor: 3 })
    expect(parsePlace('제5공학관 실험실[204호]').buildingId).toBe('eng5')
    expect(parsePlace('공동실험실습관 404호').buildingId).toBe('lab')
    expect(parsePlace('복합 스포츠센터 다목적실').buildingId).toBe('sportscenter')
    expect(parsePlace('해솔관 세미나실').buildingId).toBe('haesol')
  })
  it('모르는 곳은 전부 null', () => {
    expect(parsePlace('알 수 없는 곳')).toEqual({ buildingId: null, roomNo: null, floor: null })
  })
})

describe('parsePlace 호수 고르기', () => {
  it('대괄호 안 호수를 먼저(강의실 이름의 숫자에 먹히지 않게)', () => {
    expect(parsePlace('그린에너지연구관 2024강의실[303호]')).toMatchObject({ roomNo: '303', floor: 3 })
  })
  it('B101 같은 지하 호수는 층을 짐작하지 않는다', () => {
    expect(parsePlace('5공학관 [B101호]')).toMatchObject({ buildingId: 'eng5', roomNo: 'B101', floor: null })
  })
  it('빈 문자열은 전부 null', () => {
    expect(parsePlace('')).toEqual({ buildingId: null, roomNo: null, floor: null })
  })
})

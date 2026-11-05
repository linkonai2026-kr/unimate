// 게시판 고정 규칙과 기본·사용자 게시판 합치기 테스트
import { describe, it, expect } from 'vitest'
import { DEFAULT_PINS, mergeBoards, pinsOf, togglePin } from '@/lib/board/list'

describe('게시판 고정', () => {
  it('고른 적 없으면 기본 고정 목록', () => {
    expect(pinsOf({})).toEqual(DEFAULT_PINS)
    expect(pinsOf({ pins: [] })).toEqual([])
  })
  it('누르면 붙었다 떨어지고, 새로 고정하면 맨 뒤에 붙는다', () => {
    expect(togglePin(['free', 'info'], 'info')).toEqual(['free'])
    expect(togglePin(['free'], 'market')).toEqual(['free', 'market'])
  })
})

describe('게시판 합치기', () => {
  const custom = { id: 'b1', name: '코딩 스터디', desc: '같이 공부해요', lang: 'ko' as const, tr: { vi: { name: 'Nhóm học lập trình', desc: 'Cùng học nhé' } }, ownerId: 'u', createdAt: 0 }
  it('기본 게시판 뒤에 사용자 게시판을 보는 사람 언어로 붙인다', () => {
    const vi = mergeBoards([custom], 'vi')
    expect(vi[0].id).toBe('free')
    expect(vi.at(-1)).toMatchObject({ id: 'b1', name: 'Nhóm học lập trình', desc: 'Cùng học nhé', custom: true })
    expect(mergeBoards([custom], 'en').at(-1)?.name).toBe('코딩 스터디')
  })
  it('비밀게시판은 항상 익명 표시를 유지한다', () => {
    expect(mergeBoards([], 'ko').find(b => b.id === 'secret')?.anonOnly).toBe(true)
  })
})

describe('가상 게시판(HOT·BEST)', () => {
  it('객체 기본 속성 이름은 가상 게시판이 아니다', async () => {
    const { isVirtual, boardName } = await import('@/lib/boards')
    expect(isVirtual('hot')).toBe(true)
    expect(isVirtual('toString')).toBe(false)
    expect(isVirtual('__proto__')).toBe(false)
    expect(boardName('toString', 'ko')).toBe('toString')
    expect(boardName('best', 'en')).toBe('BEST')
  })
  it('pinsOf는 기본 목록의 복사본을 준다(고쳐도 기본값이 바뀌지 않게)', () => {
    const pins = pinsOf({})
    pins.push('x')
    expect(DEFAULT_PINS).not.toContain('x')
  })
})

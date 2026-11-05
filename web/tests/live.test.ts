// 메모리 실시간 버스의 구독·발행·해제와 SSE 토픽 권한을 검사하는 테스트
import { describe, it, expect } from 'vitest'
import { canSubscribe, publish, subscribe, dmTopic } from '@/lib/live/bus'

describe('live bus', () => {
  it('구독한 토픽만 받고, 해제 후에는 안 받는다', async () => {
    const got: string[] = []
    const off = subscribe(['board:free'], e => got.push(e.id))
    await publish({ topic: 'board:free', kind: 'new', id: 'a' })
    await publish({ topic: 'board:info', kind: 'new', id: 'b' })
    off()
    await publish({ topic: 'board:free', kind: 'new', id: 'c' })
    expect(got).toEqual(['a'])
  })
  it('같은 토픽을 두 번 넘겨도 한 번만 받고, 해제를 두 번 해도 안전하다', async () => {
    const got: string[] = []
    const off = subscribe(['post:p', 'post:p'], e => got.push(e.id))
    await publish({ topic: 'post:p', kind: 'like', id: 'x' })
    off(); off()
    expect(got).toEqual(['x'])
  })
  it('구독자가 예외를 내도 발행은 실패하지 않는다', async () => {
    const off = subscribe(['board:boom'], () => { throw new Error('listener') })
    await expect(publish({ topic: 'board:boom', kind: 'new', id: '1' })).resolves.toBeUndefined()
    off()
  })
  it('쪽지 토픽은 두 사람 순서와 무관', () => {
    expect(dmTopic('b', 'a')).toBe(dmTopic('a', 'b'))
  })
})

describe('canSubscribe (SSE 토픽 권한)', () => {
  it('쪽지는 당사자만, 친구 요청은 본인만', () => {
    expect(canSubscribe(dmTopic('me', 'you'), 'me')).toBe(true)
    expect(canSubscribe(dmTopic('a', 'b'), 'me')).toBe(false)
    expect(canSubscribe('dm:me', 'me')).toBe(false)
    expect(canSubscribe('friends:me', 'me')).toBe(true)
    expect(canSubscribe('friends:other', 'me')).toBe(false)
  })
  it('게시판·글·강의평가는 누구나, 모르는 토픽·빈 토픽·너무 긴 토픽은 거부', () => {
    expect(canSubscribe('board:all', 'me')).toBe(true)
    expect(canSubscribe('post:123', 'me')).toBe(true)
    expect(canSubscribe('reviews:자료구조, 실습', 'me')).toBe(true)
    expect(canSubscribe('admin:x', 'me')).toBe(false)
    expect(canSubscribe('board:', 'me')).toBe(false)
    expect(canSubscribe(`board:${'x'.repeat(300)}`, 'me')).toBe(false)
  })
})

// AI 비용 줄이기: 번역할 낱말이 없는 글(ㅋㅋㅋ·이모지·기호·주소만)은 AI를 부르지 않는다
import { beforeEach, describe, expect, it } from 'vitest'
import { createCommentWithTranslation, createPostWithTranslation, nothingToTranslate, toPostView, type FlowDeps } from '@/lib/board/flow'
import { LANGS } from '@/lib/i18n'
import { createMemoryStore } from '@/lib/store/memory'
import type { LiveEvent } from '@/lib/types'

let events: LiveEvent[]
let later: (() => Promise<void>)[]
let calls: number
const deps = (): FlowDeps => ({
  store: createMemoryStore(false),
  translate: async () => { calls++; return { detected: 'en', tr: Object.fromEntries(LANGS.map(l => [l.code, { body: 'x', title: 'x' }])) } },
  publish: async e => { events.push(e) },
  defer: fn => { later.push(fn) },
})
const runLater = () => Promise.all(later.map(f => f()))
beforeEach(() => { events = []; later = []; calls = 0 })

describe('번역할 낱말이 있는지', () => {
  it('웃음·울음 자모, 이모지, 숫자, 기호, 주소만 있으면 번역할 게 없다', () => {
    for (const body of ['ㅋㅋㅋㅋ', 'ㅠㅠ', 'ㅎㅎ!!', '👍👍', '❤️🔥', '!!!', '10:30', 'https://example.com/a?b=1', 'ㅋㅋ 👍 ...']) {
      expect(nothingToTranslate({ body }), body).toBe(true)
    }
  })
  it('낱말이 하나라도 있거나 뜻 있는 자모(ㅇㅋ·ㄱㄱ·ㅇㅈ)면 AI가 번역한다', () => {
    for (const body of ['ㅇㅋ', 'ㄱㄱ', 'ㅇㅈ', 'ㅋㅋ 진짜?', 'ok', '좋아요👍', '10시 5공', 'see https://example.com']) {
      expect(nothingToTranslate({ body }), body).toBe(false)
    }
  })
  it('빈 글은 대상이 아니다(원래대로 번역 자체를 건너뛴다)', () => {
    expect(nothingToTranslate({ body: '   ' })).toBe(false)
    expect(nothingToTranslate({ title: 'ㅋㅋ', body: '' })).toBe(true)
  })
})

describe('번역 흐름에서 건너뛰기', () => {
  it('"ㅋㅋㅋ" 댓글은 AI를 부르지 않고, 작성자 언어를 지킨 채 다른 언어 사용자에게 원문이 바로 보인다', async () => {
    const d = deps()
    const post = await createPostWithTranslation(d, { board: 'free', authorId: 'u1', anonymous: true, title: '점심 같이?', body: '5공 앞 12시', lang: 'ko' })
    const c = await createCommentWithTranslation(d, { postId: post.id, parentId: null, authorId: 'u2', body: 'ㅋㅋㅋㅋ👍', lang: 'vi', anonymous: true })
    await runLater()
    expect(calls).toBe(1) // 글만 번역
    const saved = (await d.store.listComments(post.id)).find(x => x.id === c.id)!
    expect(saved.lang).toBe('vi')
    expect(Object.keys(saved.tr).sort()).toEqual(LANGS.map(l => l.code).sort())
    expect(events.some(e => e.kind === 'tr' && e.id === c.id)).toBe(true)
  })
  it('이모지만 있는 글: 다른 언어 사용자에게 "번역 중"도 "번역됨"도 없이 원문', async () => {
    const d = deps()
    const post = await createPostWithTranslation(d, { board: 'free', authorId: 'u1', anonymous: true, title: '🎉🎉', body: 'ㅋㅋㅋ', lang: 'ko' })
    await runLater()
    expect(calls).toBe(0)
    const view = toPostView((await d.store.getPost(post.id))!, { viewer: 'en', viewerId: 'u9', author: null, comments: 0 })
    expect(view).toMatchObject({ title: '🎉🎉', body: 'ㅋㅋㅋ', translated: false, pending: false })
  })
})

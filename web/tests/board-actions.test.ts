// 글 저장 → 실시간 발행 → 나중 번역·AI 검수 흐름, 목록 표시 변환, 신고·이용 제한 서버 액션을 검사하는 테스트
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reportContent, submitComment, submitPost } from '@/app/board-actions'
import { sendMessage } from '@/app/friend-actions'
import { submitReview } from '@/app/review-actions'
import { fakeModerate, FAKE_VIOLATION_MARKER } from '@/lib/ai/fake'
import { reviewContent, sanctionStatus, type Verdict } from '@/lib/moderation'
import type { Store } from '@/lib/store/types'
import { createPostWithTranslation, toPostView, type FlowDeps } from '@/lib/board/flow'
import { createMemoryStore } from '@/lib/store/memory'
import type { LiveEvent } from '@/lib/types'

// 서버 액션이 쓰는 Next·세션·스토어·의존성을 대역으로 바꾼다(이 파일의 흐름 테스트는 이 모듈들을 쓰지 않는다)
const h = vi.hoisted(() => ({
  store: null as unknown as Store,
  meId: '',
  later: [] as (() => Promise<void>)[],
  refreshed: 0,
  moderate: null as null | ((i: { title?: string; body: string }) => Promise<Verdict | null>),
}))
vi.mock('next/cache', () => ({ refresh: () => { h.refreshed++ } }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) } }))
vi.mock('@/lib/auth/session', () => ({ requireUser: async () => h.store.getProfile(h.meId) }))
vi.mock('@/lib/store', () => ({ getStore: () => h.store }))
vi.mock('@/lib/live/bus', () => ({ publish: async () => {}, dmTopic: (a: string, b: string) => `dm:${[a, b].sort().join(':')}` }))
vi.mock('@/lib/board/deps', () => ({
  flowDeps: () => ({
    store: h.store,
    translate: async () => ({ detected: 'ko', tr: {} }),
    moderate: (i: { title?: string; body: string }) => h.moderate!(i),
    publish: async () => {},
    defer: (fn: () => Promise<void>) => { h.later.push(fn) },
  }),
}))

let events: LiveEvent[]
let later: (() => Promise<void>)[]
const deps = (translate: FlowDeps['translate']): FlowDeps => ({
  store: createMemoryStore(false),
  translate,
  publish: async e => { events.push(e) },
  defer: fn => { later.push(fn) },
})
const input = { board: 'free', authorId: 'u1', anonymous: true, title: 'Hello', body: 'Anyone free?', lang: 'ko' as const }
const runLater = () => Promise.all(later.map(f => f()))

beforeEach(() => { events = []; later = [] })

describe('createPostWithTranslation', () => {
  it('번역이 실패해도 글은 저장되고 new 이벤트가 나간다', async () => {
    const d = deps(async () => { throw new Error('boom') })
    const post = await createPostWithTranslation(d, input)
    await runLater()
    expect(await d.store.getPost(post.id)).not.toBeNull()
    expect(events.map(e => e.kind)).toEqual(['new', 'new'])
  })

  it('번역이 끝나면 tr이 저장되고 new 다음에 tr 이벤트', async () => {
    const d = deps(async f => ({ detected: 'ko', tr: { vi: { title: `vi:${f.title}`, body: `vi:${f.body}` } } }))
    const post = await createPostWithTranslation(d, input)
    await runLater()
    expect((await d.store.getPost(post.id))?.tr.vi?.title).toBe('vi:Hello')
    const kinds = events.map(e => e.kind)
    expect(kinds.indexOf('tr')).toBeGreaterThan(kinds.lastIndexOf('new'))
  })

  it('작성자 프로필 언어와 달라도 원문 언어는 감지값', async () => {
    const d = deps(async () => ({ detected: 'en', tr: {} }))
    const post = await createPostWithTranslation(d, input)
    await runLater()
    expect((await d.store.getPost(post.id))?.lang).toBe('en')
  })

  it('게시판 토픽과 전체 토픽으로 발행', async () => {
    const d = deps(async () => ({ detected: 'ko', tr: {} }))
    await createPostWithTranslation(d, input)
    expect(events.map(e => e.topic)).toEqual(['board:free', 'board:all'])
  })
})

describe('문맥을 이어가는 번역', () => {
  it('댓글은 원글과 앞 댓글을 문맥으로 함께 넘기고, 자기 자신은 넣지 않는다', async () => {
    const { createCommentWithTranslation } = await import('@/lib/board/flow')
    const seen: (string[] | undefined)[] = []
    const d = deps(async (_f, ctx) => { seen.push(ctx); return { detected: 'ko', tr: {} } })
    const post = await createPostWithTranslation(d, { ...input, title: '오늘 식당 같이 갈 사람?', body: '12시에 만나요' })
    await createCommentWithTranslation(d, { postId: post.id, parentId: null, authorId: 'u2', body: '저요!', lang: 'ko', anonymous: true })
    await createCommentWithTranslation(d, { postId: post.id, parentId: null, authorId: 'u3', body: '거기 어디예요?', lang: 'ko', anonymous: true })
    await runLater()
    const last = seen.at(-1)!
    expect(last[0]).toContain('오늘 식당 같이 갈 사람?')
    expect(last.join('\n')).toContain('12시에 만나요')
    expect(last.join('\n')).toContain('저요!')
    expect(last.join('\n')).not.toContain('거기 어디예요?')
  })

  it('글 자체는 문맥 없이 번역한다', async () => {
    const seen: (string[] | undefined)[] = []
    const d = deps(async (_f, ctx) => { seen.push(ctx); return { detected: 'ko', tr: {} } })
    await createPostWithTranslation(d, input)
    await runLater()
    expect(seen[0] ?? []).toEqual([])
  })

  it('쪽지 문맥은 최근 대화만, 보낸 사람 기준 나/상대로 표시하고 새 쪽지는 빼는다', async () => {
    const { messageContext } = await import('@/lib/board/flow')
    const m = (id: string, fromId: string, body: string) => ({ id, fromId, toId: fromId === 'a' ? 'b' : 'a', body, lang: 'ko' as const, tr: {}, createdAt: 0, read: false })
    const history = Array.from({ length: 10 }, (_, i) => m(`m${i}`, i % 2 ? 'b' : 'a', `말${i}`))
    const ctx = messageContext(history, history[9])
    expect(ctx).toHaveLength(6)
    expect(ctx.at(-1)).toBe('Other: 말8')
    expect(ctx.at(-2)).toBe('Sender: 말7')
    expect(ctx.join('\n')).not.toContain('말9')
  })

  it('번역 프롬프트: 문맥이 있으면 참고용 블록을 넣고, 없으면 넣지 않는다', async () => {
    const { translateUser } = await import('@/lib/ai/claude')
    expect(translateUser({ body: '거기서 봐요' }, [])).not.toContain('Earlier in this conversation')
    const p = translateUser({ body: '거기서 봐요' }, ['Post: 5공학관 식당 12시'])
    expect(p).toContain('Earlier in this conversation')
    expect(p).toContain('5공학관 식당 12시')
  })

  it('캐시: 고정 지시문(system)은 매번 같고, 글·문맥은 넣지 않으며, 건물 이름 용어집을 담는다', async () => {
    const { TRANSLATE_SYSTEM } = await import('@/lib/ai/claude')
    expect(TRANSLATE_SYSTEM).toContain('5공학관')
    expect(TRANSLATE_SYSTEM).toContain('Tòa Kỹ thuật 5')
    expect(TRANSLATE_SYSTEM).not.toContain('Fields (JSON)')
    // Haiku 5.5 최소 캐시 길이 512토큰을 넘기려면 대략 1500자 이상
    expect(TRANSLATE_SYSTEM.length).toBeGreaterThan(1500)
  })
})

describe('시간표 인식 지시문(회귀)', () => {
  it('격자 바닥은 마지막 라벨 + 1시간: 바닥까지 닿은 블록을 한 시간 일찍 끝내지 않게', async () => {
    const { TIMETABLE_SYSTEM } = await import('@/lib/ai/claude')
    expect(TIMETABLE_SYSTEM).toContain('Each hour label marks the top line of a one-hour row')
    expect(TIMETABLE_SYSTEM).toContain('The bottom edge of the grid is one hour after the last hour label')
    expect(TIMETABLE_SYSTEM).not.toMatch(/If a block is cut off at the bottom of the screenshot, use the last visible hour line as its end/)
  })
})

describe('공지 요약 지시문(회귀)', () => {
  it('마감은 학생이 직접 지켜야 하는 날짜(학과·부서의 더 늦은 마감이 아니라)', async () => {
    const { NOTICE_SYSTEM } = await import('@/lib/ai/claude')
    expect(NOTICE_SYSTEM).toContain("use the student's own deadline")
    expect(NOTICE_SYSTEM).toContain('use the end of the period')
  })
})

describe('toPostView', () => {
  it('익명 글은 작성자 정보를 내보내지 않는다', async () => {
    const store = createMemoryStore(false)
    const p = await store.createPost(input)
    const v = toPostView(p, { viewer: 'vi', viewerId: 'x', author: { nickname: '민준', nationality: 'KR' }, comments: 0 })
    expect(v.author).toBe('Ẩn danh')
    expect(JSON.stringify(v)).not.toContain('u1')
    expect(JSON.stringify(v)).not.toContain('민준')
    expect(v.nation).toBe('KR')
  })
})

describe('익명 번호(에타식)', () => {
  it('글쓴이는 익명(글쓴이), 나머지는 처음 댓글 단 순서로 익명1, 익명2', async () => {
    const { anonNumbers, toCommentView } = await import('@/lib/board/flow')
    const cs = [
      { authorId: 'b', anonymous: true }, { authorId: 'w', anonymous: true }, { authorId: 'c', anonymous: true },
      { authorId: 'b', anonymous: true }, { authorId: 'd', anonymous: false },
    ]
    const nums = anonNumbers('w', cs)
    expect([nums.get('b'), nums.get('c'), nums.get('w'), nums.get('d')]).toEqual([1, 2, undefined, undefined])
    const base = { id: 'x', postId: 'p', parentId: null, body: 'hi', lang: 'ko' as const, tr: {}, likes: [], createdAt: 0 }
    const v = (authorId: string, anonymous: boolean, isPostAuthor: boolean) =>
      toCommentView({ ...base, authorId, anonymous }, { viewer: 'ko', viewerId: 'z', author: { nickname: `닉${authorId}`, nationality: 'KR' }, isPostAuthor, anonNo: nums.get(authorId) }).author
    expect(v('b', true, false)).toBe('익명1')
    expect(v('c', true, false)).toBe('익명2')
    expect(v('w', true, true)).toBe('익명(글쓴이)')
    expect(v('d', false, false)).toBe('닉d')
  })
})

describe('프로필 사진과 익명', () => {
  it('익명 글·댓글에는 사진을 내보내지 않고, 실명이면 사진 id를 준다', async () => {
    const { toPostView, toCommentView } = await import('@/lib/board/flow')
    const author = { nickname: '민준', nationality: 'KR', avatar: 2, photo: 'img-1' }
    const store = createMemoryStore(false)
    const anon = await store.createPost({ ...input, anonymous: true })
    const named = await store.createPost({ ...input, anonymous: false })
    expect(toPostView(anon, { viewer: 'ko', viewerId: 'z', author, comments: 0 }).photo).toBeNull()
    expect(toPostView(named, { viewer: 'ko', viewerId: 'z', author, comments: 0 }).photo).toBe('img-1')
    const c = { id: 'c', postId: anon.id, parentId: null, authorId: 'u1', anonymous: true, body: 'x', lang: 'ko' as const, tr: {}, likes: [], createdAt: 0 }
    expect(toCommentView(c, { viewer: 'ko', viewerId: 'z', author, isPostAuthor: false }).photo).toBeNull()
  })
})

describe('폼 값 정리(cleanInput)', () => {
  it('문자열이 아니면 빈 값, NUL·제어 문자를 빼고 한 줄 칸은 줄바꿈을 공백으로', async () => {
    const { cleanInput } = await import('@/lib/board/flow')
    expect(cleanInput(null, 10)).toBe('')
    expect(cleanInput(new Blob(['x']), 10)).toBe('')
    expect(cleanInput('  a\u0000b\nc  ', 10)).toBe('a b c')
    expect(cleanInput('a\u0000b\r\nc', 10, true)).toBe('ab\nc')
  })
  it('길이 상한에서 자르되 이모지 반쪽을 남기지 않는다', async () => {
    const { cleanInput } = await import('@/lib/board/flow')
    expect(cleanInput('ab😀', 3)).toBe('ab')
    expect(cleanInput('ab😀', 4)).toBe('ab😀')
  })
})

describe('translateLater', () => {
  it('번역할 내용이 비었으면 예약하지 않는다', async () => {
    const { translateLater } = await import('@/lib/board/flow')
    const d = deps(async () => ({ detected: 'ko', tr: {} }))
    translateLater(d, 'post', 'x', { title: ' ', body: '' }, ['board:free'])
    expect(later).toHaveLength(0)
  })
  it('문맥을 만드는 중 실패해도 예외가 새지 않고 원문을 둔다', async () => {
    const { translateLater } = await import('@/lib/board/flow')
    const d = deps(async () => ({ detected: 'ko', tr: { en: { body: 'x' } } }))
    translateLater(d, 'comment', 'c1', { body: '안녕' }, ['post:p'], async () => { throw new Error('db down') })
    await expect(runLater()).resolves.toBeDefined()
    expect(events).toHaveLength(0)
  })
})

describe('commentContext', () => {
  it('원글이 없으면 앞 댓글만 최대 6줄', async () => {
    const { commentContext } = await import('@/lib/board/flow')
    const c = (i: number) => ({ id: `c${i}`, postId: 'p', parentId: null, authorId: 'a', anonymous: true, body: `댓글${i}`, lang: 'ko' as const, tr: {}, likes: [], createdAt: i })
    const ctx = commentContext(null, Array.from({ length: 9 }, (_, i) => c(i)))
    expect(ctx).toHaveLength(6)
    expect(ctx.at(-1)).toBe('Comment: 댓글8')
  })
})

describe('새 글·댓글 AI 검수(응답 뒤)', () => {
  const withProfile = async (d: FlowDeps) => d.store.createProfile({ handle: 'writer', nickname: 'W', nationality: 'KR', lang: 'ko', passHash: '' })

  it('대역 검수기: 욕설·도박 광고·테스트 표시어만 위반, 평범한 낱말은 통과', () => {
    expect(fakeModerate({ body: `안녕 ${FAKE_VIOLATION_MARKER}` })).toMatchObject({ violation: true, rule: 'respect' })
    expect(fakeModerate({ title: '카지노 홍보', body: '가입하세요' })).toMatchObject({ violation: true, rule: 'spam' })
    expect(fakeModerate({ body: '이번 학기의 시발점은 중간고사' }).violation).toBe(false)
    expect(fakeModerate({ body: '오늘 학식 맛있어요' })).toMatchObject({ violation: false, rule: 'none' })
  })

  it('위반 글은 응답 뒤에 가려지고 작성자는 경고 1/2, 등록 자체는 막지 않는다', async () => {
    const d: FlowDeps = { ...deps(async () => ({ detected: 'ko', tr: {} })), moderate: async i => fakeModerate(i) }
    const a = await withProfile(d)
    const post = await createPostWithTranslation(d, { ...input, authorId: a.id, body: `${FAKE_VIOLATION_MARKER} 테스트` })
    expect((await d.store.getPost(post.id))?.hidden).toBeUndefined()
    await runLater()
    expect((await d.store.getPost(post.id))?.hidden).toBe(true)
    const me = await d.store.getProfile(a.id)
    expect(sanctionStatus(me!)).toEqual({ kind: 'warning', n: 1 })
    expect(events.some(e => e.kind === 'del' && e.id === post.id)).toBe(true)
    expect(toPostView((await d.store.getPost(post.id))!, { viewer: 'ko', viewerId: a.id, author: me, comments: 0 })).toMatchObject({ hidden: true, title: '', body: '', originalBody: '' })
  })

  it('검수기가 실패(null)하거나 던져도 제재하지 않고 글은 그대로', async () => {
    for (const moderate of [async () => null, async () => { throw new Error('ai down') }] as FlowDeps['moderate'][]) {
      later = []
      const d: FlowDeps = { ...deps(async () => ({ detected: 'ko', tr: {} })), moderate }
      const a = await withProfile(d)
      const post = await createPostWithTranslation(d, { ...input, authorId: a.id, body: `${FAKE_VIOLATION_MARKER}` })
      await runLater()
      expect((await d.store.getPost(post.id))?.hidden).toBeUndefined()
      expect((await d.store.getProfile(a.id))?.violations).toBeUndefined()
    }
  })

  it('검수 실패면 신고는 pending으로 남고, 통과면 clean으로 적힌다', async () => {
    const store = createMemoryStore(false)
    const post = await store.createPost({ ...input, authorId: 'w1' })
    await store.createReport({ reporterId: 'r1', kind: 'post', targetId: post.id, authorId: 'w1', reason: 'spam', detail: '' })
    const publish = async () => {}
    expect(await reviewContent({ store, publish, moderate: async () => null }, 'post', post.id)).toBe('error')
    expect((await store.listReports('post', post.id))[0].status).toBe('pending')
    expect((await store.getPost(post.id))?.hidden).toBeUndefined()
    const clean: Verdict = { violation: false, rule: 'none', severity: 'low', reason: 'ok' }
    expect(await reviewContent({ store, publish, moderate: async () => clean }, 'post', post.id)).toBe('clean')
    expect((await store.listReports('post', post.id))[0].status).toBe('clean')
  })
})

describe('신고·이용 제한 서버 액션', () => {
  let store: Store
  let me: string, other: string
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
  const redirectOf = async (p: Promise<unknown>) => {
    try { await p } catch (e) { return (e as { url?: string }).url ?? null }
    return null
  }
  const runAll = async () => { const fns = h.later.splice(0); for (const f of fns) await f() }

  beforeEach(async () => {
    store = createMemoryStore(false)
    h.store = store
    h.later = []
    h.refreshed = 0
    h.moderate = async i => fakeModerate(i)
    me = (await store.createProfile({ handle: 'reporter', nickname: 'R', nationality: 'KR', lang: 'ko', passHash: '' })).id
    other = (await store.createProfile({ handle: 'writer2', nickname: 'W', nationality: 'VN', lang: 'vi', passHash: '' })).id
    h.meId = me
  })

  it('남의 글 신고 → 접수, 같은 글 다시 신고 → 이미 신고함', async () => {
    const post = await store.createPost({ ...input, authorId: other })
    expect(await redirectOf(reportContent('post', post.id, form({ reason: 'spam' })))).toBe(`/post/${post.id}?reported=ok`)
    expect(await redirectOf(reportContent('post', post.id, form({ reason: 'respect' })))).toBe(`/post/${post.id}?reported=dup`)
    expect(await store.listReports('post', post.id)).toHaveLength(1)
  })

  it('내 글·댓글은 신고할 수 없다', async () => {
    const post = await store.createPost({ ...input, authorId: me })
    const c = await store.createComment({ postId: post.id, parentId: null, authorId: me, anonymous: true, body: '내 댓글', lang: 'ko' })
    expect(await redirectOf(reportContent('post', post.id, form({ reason: 'spam' })))).toBe(`/post/${post.id}?reported=own`)
    expect(await redirectOf(reportContent('comment', c.id, form({ reason: 'spam' })))).toBe(`/post/${post.id}?reported=own`)
    expect(await store.listReports('post', post.id)).toEqual([])
  })

  it('신고된 댓글이 위반이면 응답 뒤 가려지고 작성자 경고, 신고는 violation', async () => {
    const post = await store.createPost({ ...input, authorId: me })
    const c = await store.createComment({ postId: post.id, parentId: null, authorId: other, anonymous: true, body: '씨발 진짜', lang: 'ko' })
    // 새 댓글 자동 검수가 아니라 신고로 들어온 경우만 보려고 스토어에 바로 넣었다
    expect(await redirectOf(reportContent('comment', c.id, form({ reason: 'respect', detail: '욕설이에요' })))).toBe(`/post/${post.id}?reported=ok`)
    await runAll()
    expect((await store.getComment(c.id))?.hidden).toBe(true)
    expect((await store.getProfile(other))?.violations).toBe(1)
    expect((await store.listReports('comment', c.id))[0]).toMatchObject({ status: 'violation', detail: '욕설이에요', authorId: other })
  })

  it('AI 실패면 신고는 남고 제재는 없다', async () => {
    h.moderate = async () => null
    const post = await store.createPost({ ...input, authorId: other, body: '씨발' })
    await redirectOf(reportContent('post', post.id, form({ reason: 'respect' })))
    await runAll()
    expect((await store.getPost(post.id))?.hidden).toBeUndefined()
    expect((await store.listReports('post', post.id))[0].status).toBe('pending')
  })

  it('이용 제한 중이면 글·댓글·쪽지가 저장되지 않고, 풀리면 다시 쓸 수 있다', async () => {
    const target = await store.createPost({ ...input, authorId: other })
    const mine = await Promise.all([1, 2, 3].map(() => store.createPost({ ...input, authorId: me })))
    const now = Date.now()
    for (const p of mine) await store.applyViolation('post', p.id, 'respect', now)
    expect(sanctionStatus((await store.getProfile(me))!)).toMatchObject({ kind: 'suspended', rule: 'respect' })

    expect(await redirectOf(submitPost('free', form({ title: '제목', body: '본문' })))).toBeNull()
    expect(await redirectOf(submitComment(target.id, form({ body: '댓글' })))).toBeNull()
    expect(await redirectOf(sendMessage('writer2', form({ body: '안녕' })))).toBeNull()
    expect(h.refreshed).toBe(3)
    expect(await store.listPosts({ board: 'free' })).toHaveLength(1)
    expect(await store.listComments(target.id)).toEqual([])
    expect(await store.listMessages(me, other)).toEqual([])

    // 제한 기간이 지난 사람(8일 전에 세 번째 위반)은 다시 쓸 수 있다
    const olds = await Promise.all([1, 2, 3].map(() => store.createPost({ ...input, authorId: other })))
    for (const p of olds) await store.applyViolation('post', p.id, 'spam', now - 8 * 24 * 60 * 60_000)
    h.meId = other
    expect(sanctionStatus((await store.getProfile(other))!)).toEqual({ kind: 'repeat', n: 3 })
    expect(await redirectOf(submitComment(target.id, form({ body: '댓글' })))).toBe(`/post/${target.id}`)
  })
  it('강의평가는 과목마다 한 사람 한 번만 저장된다', async () => {
    const review = () => form({ rating: '5', body: '좋은 수업이에요' })
    expect(await redirectOf(submitReview('자료구조', review()))).toBe('/lectures/' + encodeURIComponent('자료구조'))
    expect(await redirectOf(submitReview('자료구조', review()))).toBeNull()
    expect((await store.listReviews('자료구조')).filter(r => r.authorId === me)).toHaveLength(1)
    // 다른 과목은 쓸 수 있다
    expect(await redirectOf(submitReview('운영체제', review()))).toBe('/lectures/' + encodeURIComponent('운영체제'))
  })
})

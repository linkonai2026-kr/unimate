// 메모리·Supabase 스토어의 글·공감·번역·시간표·친구·쪽지 동작이 같은지 검사하는 테스트
import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createMemoryStore } from '@/lib/store/memory'
import { createSupabaseStore } from '@/lib/store/supabase'
import type { Store } from '@/lib/store/types'
import { CURRENT_SEM } from '@/lib/timetable/sem'

// 같은 계약을 메모리 스토어와 (키가 있으면) Supabase 스토어에 똑같이 돌린다.
// 실서버에서는 데이터가 남으므로 사용자·게시판 id에 매번 새 접두어를 붙인다
const IMPLS: [string, () => Store][] = [['memory', () => createMemoryStore(false)]]
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) IMPLS.push(['supabase', () => createSupabaseStore()])

describe.each(IMPLS)('%s store', (_name, make) => {
let s: Store
let u1: string, board: string
const newPost = (over = {}) => ({ board, authorId: u1, anonymous: true, title: '제목', body: '본문', lang: 'ko' as const, ...over })

beforeEach(() => { s = make(); const r = randomUUID().slice(0, 8); u1 = `u1-${r}`; board = `free-${r}` })

describe('기본', () => {
  it('새 글이 목록 맨 앞에 온다', async () => {
    await s.createPost(newPost({ title: '먼저' }))
    const p = await s.createPost(newPost({ title: '나중' }))
    expect((await s.listPosts({ board }))[0].id).toBe(p.id)
  })

  it('공감은 토글된다', async () => {
    const p = await s.createPost(newPost())
    expect(await s.toggleLike('post', p.id, u1)).toBe(1)
    expect(await s.toggleLike('post', p.id, u1)).toBe(0)
  })

  it('HOT은 공감 10개 이상만', async () => {
    const hot = await s.createPost(newPost())
    await s.createPost(newPost())
    for (let i = 0; i < 10; i++) await s.toggleLike('post', hot.id, `x${i}`)
    const list = await s.listPosts({ hot: true, board })
    expect(list.map(p => p.id)).toEqual([hot.id])
  })

  it('번역을 저장하면 글에 붙고 원문 언어가 감지값으로 바뀐다', async () => {
    const p = await s.createPost(newPost())
    await s.setTr('post', p.id, { vi: { title: 'x', body: 'y' } }, 'en')
    const got = await s.getPost(p.id)
    expect(got?.tr.vi?.title).toBe('x')
    expect(got?.lang).toBe('en')
  })

  it('시간표는 통째로 교체된다', async () => {
    await s.replaceCourses(u1, [{ name: 'A', place: '', day: 0, start: 540, end: 600 }])
    await s.replaceCourses(u1, [{ name: 'B', place: '', day: 1, start: 600, end: 660 }])
    expect((await s.listCourses(u1)).map(c => c.name)).toEqual(['B'])
  })

  it('가입 정보에 표에 없는 키(평문 password 등)가 섞이면 저장하지 않는다', async () => {
    const bad = { handle: `pw${u1}`, nickname: 'P', nationality: 'KR', lang: 'ko' as const, passHash: '', password: 'plain' }
    await expect(s.createProfile(bad)).rejects.toThrow()
    expect(await s.getProfileByHandle(`pw${u1}`)).toBeNull()
  })

  it('친구는 양방향', async () => {
    const a = await s.createProfile({ handle: `a${u1}`, nickname: 'A', nationality: 'KR', lang: 'ko', passHash: '' })
    const b = await s.createProfile({ handle: `b${u1}`, nickname: 'B', nationality: 'VN', lang: 'vi', passHash: '' })
    await s.addFriend(a.id, b.id)
    expect((await s.listFriends(b.id)).map(p => p.id)).toContain(a.id)
  })

  it('친구 요청은 상대가 수락해야 친구가 된다', async () => {
    const a = await s.createProfile({ handle: `ra${u1}`, nickname: 'A', nationality: 'KR', lang: 'ko', passHash: '' })
    const b = await s.createProfile({ handle: `rb${u1}`, nickname: 'B', nationality: 'VN', lang: 'vi', passHash: '' })
    expect(await s.requestFriend(a.id, b.id)).toBe('sent')
    expect(await s.requestFriend(a.id, b.id)).toBe('sent')
    expect(await s.listFriends(a.id)).toEqual([])
    expect((await s.listRequests(b.id)).incoming.map(p => p.id)).toEqual([a.id])
    expect((await s.listRequests(a.id)).outgoing).toEqual([b.id])
    await s.respondFriend(b.id, a.id, true)
    expect((await s.listFriends(a.id)).map(p => p.id)).toEqual([b.id])
    expect((await s.listRequests(b.id)).incoming).toEqual([])
    expect(await s.requestFriend(a.id, b.id)).toBe('already')
  })

  it('거절하면 요청만 사라지고, 서로 요청하면 바로 친구', async () => {
    const a = await s.createProfile({ handle: `xa${u1}`, nickname: 'A', nationality: 'KR', lang: 'ko', passHash: '' })
    const b = await s.createProfile({ handle: `xb${u1}`, nickname: 'B', nationality: 'VN', lang: 'vi', passHash: '' })
    await s.requestFriend(a.id, b.id)
    await s.respondFriend(b.id, a.id, false)
    expect(await s.listFriends(b.id)).toEqual([])
    expect((await s.listRequests(a.id)).outgoing).toEqual([])
    // 요청이 없는데 수락해도 친구가 되지 않는다
    await s.respondFriend(b.id, a.id, true)
    expect(await s.listFriends(b.id)).toEqual([])
    await s.requestFriend(a.id, b.id)
    expect(await s.requestFriend(b.id, a.id)).toBe('accepted')
    expect((await s.listFriends(b.id)).map(p => p.id)).toEqual([a.id])
  })

  it('쪽지는 어느 쪽에서 봐도 같은 대화', async () => {
    const a = `a-${u1}`, b = `b-${u1}`
    await s.createMessage({ fromId: a, toId: b, body: 'hi', lang: 'en' })
    expect(await s.listMessages(a, b)).toEqual(await s.listMessages(b, a))
    expect((await s.listMessages(a, b)).length).toBe(1)
  })

})

describe('시간표 여러 개(학기별)', () => {
  const SEM = CURRENT_SEM
  it('처음 열면 기본 시간표 하나가 생긴다', async () => {
    const t = await s.listTables(u1, SEM)
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ name: '시간표 1', primary: true })
  })
  it('기본 시간표는 하나뿐이고, 기본을 지우면 남은 것이 기본이 된다', async () => {
    const [a] = await s.listTables(u1, SEM)
    const b = await s.createTable(u1, SEM, '플랜 B')
    expect(b.primary).toBe(false)
    await s.setPrimary(b.id)
    expect((await s.listTables(u1, SEM)).filter(x => x.primary).map(x => x.id)).toEqual([b.id])
    await s.deleteTable(b.id)
    const left = await s.listTables(u1, SEM)
    expect(left.map(x => [x.id, x.primary])).toEqual([[a.id, true]])
  })
  it('마지막 시간표는 지워지지 않는다', async () => {
    const [a] = await s.listTables(u1, SEM)
    await s.deleteTable(a.id)
    expect(await s.listTables(u1, SEM)).toHaveLength(1)
  })
  it('listCourses는 이번 학기 기본 시간표의 강의', async () => {
    const [a] = await s.listTables(u1, SEM)
    const b = await s.createTable(u1, SEM, '플랜 B')
    await s.replaceTableCourses(a.id, [{ name: 'A', place: '', day: 0, start: 540, end: 600 }])
    await s.replaceTableCourses(b.id, [{ name: 'B', place: '', day: 0, start: 540, end: 600 }])
    expect((await s.listCourses(u1)).map(c => c.name)).toEqual(['A'])
    await s.setPrimary(b.id)
    expect((await s.listCourses(u1)).map(c => c.name)).toEqual(['B'])
  })
  it('블록 색을 저장한다', async () => {
    const [a] = await s.listTables(u1, SEM)
    await s.updateTable(a.id, { colors: { A: 3 } })
    expect((await s.listTables(u1, SEM))[0].colors).toEqual({ A: 3 })
  })
})

describe('프로필 사진', () => {
  it('사진 id를 저장하고 지울 수 있다', async () => {
    const p = await s.createProfile({ handle: `ph${u1}`, nickname: 'P', nationality: 'KR', lang: 'ko', passHash: '' })
    await s.updateProfile(p.id, { photo: 'img-9' })
    expect((await s.getProfile(p.id))?.photo).toBe('img-9')
    await s.updateProfile(p.id, { photo: null })
    expect((await s.getProfile(p.id))?.photo ?? null).toBeNull()
  })
})

describe('사용자 게시판·고정', () => {
  it('만든 게시판이 목록에 오고, 번역을 붙일 수 있다', async () => {
    const b = await s.createBoard({ name: `코딩 스터디 ${u1}`, desc: '같이 공부해요', lang: 'ko', ownerId: u1 })
    expect((await s.listBoards()).find(x => x.id === b.id)?.name).toBe(`코딩 스터디 ${u1}`)
    await s.setTr('board', b.id, { vi: { name: 'Nhóm học lập trình', desc: 'Cùng học nhé' } }, 'ko')
    expect((await s.listBoards()).find(x => x.id === b.id)?.tr.vi?.name).toBe('Nhóm học lập trình')
  })
  it('게시판을 지우면 그 안의 글·댓글도 지워진다', async () => {
    const b = await s.createBoard({ name: `지울 게시판 ${u1}`, desc: '', lang: 'ko', ownerId: u1 })
    const p = await s.createPost({ board: b.id, authorId: u1, anonymous: true, title: '제목', body: '본문', lang: 'ko' })
    const c = await s.createComment({ postId: p.id, authorId: u1, anonymous: true, body: '댓글', lang: 'ko', parentId: null })
    await s.deleteBoard(b.id)
    expect((await s.listBoards()).some(x => x.id === b.id)).toBe(false)
    expect(await s.getPost(p.id)).toBeNull()
    expect(await s.getComment(c.id)).toBeNull()
  })
  it('고정한 게시판 목록을 프로필에 저장한다', async () => {
    const p = await s.createProfile({ handle: `pin${u1}`, nickname: 'P', nationality: 'KR', lang: 'ko', passHash: '' })
    await s.updateProfile(p.id, { pins: ['free', 'market'] })
    expect((await s.getProfile(p.id))?.pins).toEqual(['free', 'market'])
  })
})

describe('사진', () => {
  it('저장한 사진을 같은 바이트·형식으로 돌려준다', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3])
    const id = await s.saveImage(bytes, 'image/jpeg', u1)
    const got = await s.getImage(id)
    expect(got?.type).toBe('image/jpeg')
    expect(Buffer.from(got!.data).equals(bytes)).toBe(true)
    expect(await s.getImage('없는-id')).toBeNull()
  })
  it('글에 사진 id를 붙여 저장한다', async () => {
    const p = await s.createPost(newPost({ images: ['a', 'b'] }))
    expect((await s.getPost(p.id))?.images).toEqual(['a', 'b'])
    expect((await s.getPost((await s.createPost(newPost())).id))?.images).toEqual([])
  })
  it('글을 고치면 제목·본문·언어가 바뀌고 옛 번역은 비워진다', async () => {
    const p = await s.createPost(newPost({ images: ['a'] }))
    await s.setTr('post', p.id, { en: { title: 'T', body: 'B' } }, 'ko')
    await s.updatePost(p.id, { title: '새 제목', body: '새 본문', lang: 'vi' })
    const got = await s.getPost(p.id)
    expect([got?.title, got?.body, got?.lang]).toEqual(['새 제목', '새 본문', 'vi'])
    expect(got?.tr).toEqual({})
    expect(got?.images).toEqual(['a'])
  })
})

describe('강좌 목록·학점 기록', () => {
  it('강좌 목록은 코드로 중복 없이 보탠다', async () => {
    const code = `X-${u1}`
    const c = { code, name: 'X', prof: '', credit: 3, type: 'major' as const, place: '', slots: [] }
    await s.addCatalog([c, c])
    await s.addCatalog([c])
    expect((await s.listCatalog()).filter(x => x.code === code)).toHaveLength(1)
  })
  it('학점 기록 저장·조회', async () => {
    expect(await s.getGrades(u1)).toEqual([])
    await s.setGrades(u1, [{ name: '1학년 1학기', rows: [] }])
    expect((await s.getGrades(u1))[0].name).toBe('1학년 1학기')
  })
})
describe('신고·위반 처리', () => {
  const DAY = 24 * 60 * 60_000
  const author = () => s.createProfile({ handle: `m${u1}${randomUUID().slice(0, 4)}`, nickname: 'M', nationality: 'KR', lang: 'ko', passHash: '' })
  const report = (over = {}) => ({ reporterId: 'rep1', kind: 'post' as const, targetId: 'x', authorId: u1, reason: 'spam', detail: '', ...over })

  it('같은 사람이 같은 글을 두 번 신고하면 두 번째는 null, 다른 사람은 따로 저장', async () => {
    const p = await s.createPost(newPost())
    const first = await s.createReport(report({ targetId: p.id }))
    expect(first).toMatchObject({ reporterId: 'rep1', kind: 'post', targetId: p.id, status: 'pending' })
    expect(await s.createReport(report({ targetId: p.id, reason: 'respect' }))).toBeNull()
    expect(await s.createReport(report({ targetId: p.id, reporterId: 'rep2' }))).not.toBeNull()
    // 같은 id라도 글과 댓글은 다른 대상
    expect(await s.createReport(report({ targetId: p.id, kind: 'comment' }))).not.toBeNull()
    expect((await s.listReports('post', p.id)).map(r => r.reporterId)).toEqual(['rep1', 'rep2'])
  })

  it('검수 결과는 대기 중 신고에만 적힌다', async () => {
    const p = await s.createPost(newPost())
    await s.createReport(report({ targetId: p.id }))
    await s.resolveReports('post', p.id, 'clean')
    await s.createReport(report({ targetId: p.id, reporterId: 'rep2' }))
    await s.resolveReports('post', p.id, 'violation')
    expect((await s.listReports('post', p.id)).map(r => r.status)).toEqual(['clean', 'violation'])
  })

  it('위반이면 가려지고 경고 1, 같은 글은 두 번 세지 않는다', async () => {
    const a = await author()
    const p = await s.createPost(newPost({ authorId: a.id }))
    const now = Date.now()
    expect(await s.applyViolation('post', p.id, 'respect', now)).toEqual({ authorId: a.id, violations: 1, suspendedUntil: null })
    expect((await s.getPost(p.id))?.hidden).toBe(true)
    expect(await s.applyViolation('post', p.id, 'respect', now)).toBeNull()
    expect((await s.getProfile(a.id))?.violations).toBe(1)
    expect(await s.applyViolation('post', 'no-such-post', 'respect', now)).toBeNull()
  })

  it('동시에 같은 글을 처리해도 한 번만 센다', async () => {
    const a = await author()
    const p = await s.createPost(newPost({ authorId: a.id }))
    const results = await Promise.all([1, 2, 3].map(() => s.applyViolation('post', p.id, 'spam', Date.now())))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect((await s.getProfile(a.id))?.violations).toBe(1)
  })

  it('경고 2번 뒤 3번째 위반은 7일, 4번째는 30일 이용 제한(사유 기록)', async () => {
    const a = await author()
    const now = Date.now()
    const posts = await Promise.all([1, 2, 3].map(() => s.createPost(newPost({ authorId: a.id }))))
    const c = await s.createComment({ postId: posts[0].id, parentId: null, authorId: a.id, anonymous: true, body: '댓글', lang: 'ko' })
    await s.applyViolation('post', posts[0].id, 'respect', now)
    expect(await s.applyViolation('post', posts[1].id, 'respect', now)).toMatchObject({ violations: 2, suspendedUntil: null })
    expect((await s.getProfile(a.id))?.suspendedUntil ?? null).toBeNull()
    expect(await s.applyViolation('post', posts[2].id, 'spam', now)).toEqual({ authorId: a.id, violations: 3, suspendedUntil: now + 7 * DAY })
    expect(await s.getProfile(a.id)).toMatchObject({ violations: 3, suspendedUntil: now + 7 * DAY, sanctionReason: 'spam' })
    // 댓글도 같은 횟수에 더해진다
    expect(await s.applyViolation('comment', c.id, 'conflict', now)).toMatchObject({ violations: 4, suspendedUntil: now + 30 * DAY })
    expect((await s.getComment(c.id))?.hidden).toBe(true)
    expect((await s.getProfile(a.id))?.sanctionReason).toBe('conflict')
  })

  it('가려진 글은 게시판·검색·HOT·BEST·내 글 목록에서 빠지고, 상세(getPost)로는 읽힌다', async () => {
    const a = await author()
    const bad = await s.createPost(newPost({ authorId: a.id, title: '검색어고양이' }))
    const ok = await s.createPost(newPost({ authorId: a.id, title: '검색어고양이 둘' }))
    for (let i = 0; i < 10; i++) { await s.toggleLike('post', bad.id, `x${i}`); await s.toggleLike('post', ok.id, `x${i}`) }
    await s.applyViolation('post', bad.id, 'respect', Date.now())
    const ids = (list: { id: string }[]) => list.map(p => p.id)
    expect(ids(await s.listPosts({ board }))).toEqual([ok.id])
    expect(ids(await s.listPosts({ query: '검색어고양이' }))).toEqual([ok.id])
    expect(ids(await s.listPosts({ hot: true, board }))).toEqual([ok.id])
    expect(ids(await s.listPosts({ best: true, board }))).toEqual([ok.id])
    expect(ids(await s.listPosts({ authorId: a.id }))).toEqual([ok.id])
    expect((await s.getPost(bad.id))?.hidden).toBe(true)
  })
})
})

describe.each(IMPLS)('%s store: 두 구현이 같아야 하는 세부 동작', (_name, make) => {
  let s: Store
  let r: string
  beforeEach(() => { s = make(); r = randomUUID().slice(0, 8) })
  const profile = (h: string) => s.createProfile({ handle: `${h}${r}`, nickname: h, nationality: 'KR', lang: 'ko', passHash: '' })

  it('같은 handle로 두 번 가입하면 던진다', async () => {
    await profile('dup')
    await expect(profile('dup')).rejects.toThrow()
  })

  it('돌려받은 값을 고쳐도 저장값은 그대로', async () => {
    const p = await s.createPost({ board: `b-${r}`, authorId: `u-${r}`, anonymous: true, title: 't', body: 'b', lang: 'ko' })
    p.likes.push('hacker')
    ;(await s.getPost(p.id))!.title = '바뀜'
    const got = await s.getPost(p.id)
    expect(got?.likes).toEqual([])
    expect(got?.title).toBe('t')
  })

  it('비어 있는 선택 칸은 빠진 채로 돌아온다(null 대신 없음)', async () => {
    const p = await profile('nul')
    const got = (await s.getProfile(p.id))!
    expect('avatar' in got).toBe(false)
    expect('major' in got).toBe(false)
    await s.updateProfile(p.id, { major: undefined, nickname: '새이름' })
    expect((await s.getProfile(p.id))?.nickname).toBe('새이름')
  })

  it('검색은 번역문에서도 찾고, 필터 문법 문자가 있어도 깨지지 않는다', async () => {
    const board = `s-${r}`
    const p = await s.createPost({ board, authorId: `u-${r}`, anonymous: true, title: `학식 ${r}`, body: '본문', lang: 'ko' })
    await s.setTr('post', p.id, { vi: { title: `Căng tin ${r}`, body: 'x' } }, 'ko')
    expect((await s.listPosts({ board, query: `căng TIN ${r}` })).map(x => x.id)).toEqual([p.id])
    for (const q of ['%', '_', '*', 'a,b)', '"x"', '\\', 'title.eq.x', `학식 ${r}),body.ilike.(%`])
      await expect(s.listPosts({ board, query: q })).resolves.toBeInstanceOf(Array)
    // 와일드카드만 있는 검색어는 조건이 없는 것으로(모든 글)
    expect((await s.listPosts({ board, query: '%%' })).map(x => x.id)).toEqual([p.id])
    expect(await s.listPosts({ board, query: '_' })).toHaveLength(1)
    expect(await s.listPosts({ board, query: '없는말' })).toEqual([])
  })

  it('대화 목록은 상대별 마지막 쪽지, 최근 대화 순', async () => {
    const me = await profile('me'), a = await profile('ta'), b = await profile('tb')
    await s.createMessage({ fromId: me.id, toId: a.id, body: '1', lang: 'ko' })
    await s.createMessage({ fromId: b.id, toId: me.id, body: '2', lang: 'ko' })
    await s.createMessage({ fromId: a.id, toId: me.id, body: '3', lang: 'ko' })
    const threads = await s.listThreads(me.id)
    expect(threads.map(x => [x.other.id, x.last.body])).toEqual([[a.id, '3'], [b.id, '2']])
  })

  it('바로 친구가 되면 둘 사이에 남은 요청은 사라진다', async () => {
    const a = await profile('fa'), b = await profile('fb')
    await s.requestFriend(a.id, b.id)
    await s.addFriend(a.id, b.id)
    expect((await s.listRequests(b.id)).incoming).toEqual([])
    expect((await s.listRequests(a.id)).outgoing).toEqual([])
  })

  it('메서드를 꺼내 따로 불러도 동작한다(this에 기대지 않음)', async () => {
    const a = await profile('ma'), b = await profile('mb')
    const { requestFriend, respondFriend } = s
    expect(await requestFriend(a.id, b.id)).toBe('sent')
    await respondFriend(b.id, a.id, true)
    expect(await requestFriend(b.id, a.id)).toBe('already')
  })

  it('기본 시간표 id는 사용자·학기마다 정해져 있다', async () => {
    const u = `u-${r}`
    const [first] = await s.listTables(u, '2027년 1학기')
    const [again] = await s.listTables(u, '2027년 1학기')
    expect(again.id).toBe(first.id)
    expect((await s.listTables(u, '2027년 2학기'))[0].id).not.toBe(first.id)
  })

  it('강의 교체는 저장할 칸만 남긴다', async () => {
    const u = `u-${r}`
    await s.replaceCourses(u, [{ name: 'A', place: 'P', day: 2, start: 540, end: 600, code: undefined, id: 'x', userId: 'evil' } as never])
    const [c] = await s.listCourses(u)
    expect(c).toMatchObject({ name: 'A', place: 'P', day: 2, start: 540, end: 600, userId: u })
    expect(c.id).not.toBe('x')
    expect('code' in c).toBe(false)
  })
})

describe('메모리 시드', () => {
  it('데모 계정 minjun(ko)과 linh(vi)이 있다', async () => {
    const seeded = createMemoryStore(true)
    expect((await seeded.getProfileByHandle('minjun'))?.lang).toBe('ko')
    expect((await seeded.getProfileByHandle('linh'))?.lang).toBe('vi')
  })
  it('강좌 목록에 개설 강좌 예시와 데모 캡처 과목이 있다', async () => {
    const names = (await createMemoryStore(true).listCatalog()).map(c => c.name)
    expect(names).toContain('네트워크프로그래밍')
    expect(names).toContain('컴퓨터네트워크')
  })
})

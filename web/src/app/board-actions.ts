'use server'
// 게시판 서버 액션: 글·댓글 작성, 글 수정, 공감, 스크랩, 삭제, 신고, 게시판 고정·만들기·삭제
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { cleanInput, createCommentWithTranslation, createPostWithTranslation, moderateLater, translateLater } from '@/lib/board/flow'
import { loadBoards, pinsOf, togglePin } from '@/lib/board/list'
import { flowDeps } from '@/lib/board/deps'
import { publish } from '@/lib/live/bus'
import { MAX_IMAGE_BYTES, MAX_IMAGES, sniffImage } from '@/lib/images'
import { isSuspended, REPORT_DETAIL_MAX, REPORT_REASONS } from '@/lib/moderation'
import { createLimiter } from '@/lib/rate-limit'
import { getStore } from '@/lib/store'

/** 길이 상한(폼 maxLength와 같다) */
const LIMITS = { title: 100, body: 5000, comment: 2000, boardName: 20, boardDesc: 60 } as const

// 서버 액션은 누구나 직접 부를 수 있으니 인자 모양부터 검사한다
const Id = z.string().min(1).max(100)
const Kind = z.enum(['post', 'comment'])
const Want = z.boolean()
const Reason = z.enum(REPORT_REASONS)

// 사람마다 도배 제한(프로세스 메모리). 정상 사용으로는 닿지 않을 만큼 넉넉하게
const postLimit = createLimiter({ limit: 10, windowMs: 10 * 60_000 })
const commentLimit = createLimiter({ limit: 30, windowMs: 5 * 60_000 })
const reactLimit = createLimiter({ limit: 120, windowMs: 60_000 })
const boardLimit = createLimiter({ limit: 3, windowMs: 60 * 60_000 })
const reportLimit = createLimiter({ limit: 10, windowMs: 10 * 60_000 })

/** 신고 결과(글 화면이 ?reported= 값으로 안내 문구를 고른다) */
export type ReportResult = 'ok' | 'dup' | 'own' | 'limit' | 'fail'

/**
 * 이용 제한 중이면 저장하지 않고 화면을 다시 그린다(글쓰기·댓글·쪽지 화면이 입력칸 대신 제한 안내를 보여 준다).
 * 서버 액션은 화면을 거치지 않고도 부를 수 있으니 화면과 별개로 여기서 막는다
 */
function blockedBySanction(me: { suspendedUntil?: number | null }) {
  if (!isSuspended(me)) return false
  refresh()
  return true
}

export async function submitPost(boardId: string, f: FormData) {
  const me = await requireUser()
  if (blockedBySanction(me)) return
  const id = Id.safeParse(boardId)
  if (!id.success) return
  const board = (await loadBoards(getStore(), me.lang)).find(b => b.id === id.data)
  const title = cleanInput(f.get('title'), LIMITS.title), body = cleanInput(f.get('body'), LIMITS.body, true)
  if (!board || !title || !body || !postLimit(me.id)) return
  // 사진은 앞 바이트로 형식을 확인한 것만, 최대 4장·장당 1.5MB까지 받는다
  const images: string[] = []
  for (const file of f.getAll('images')) {
    if (images.length >= MAX_IMAGES) break
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) continue
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImage(bytes)
    if (type) images.push(await getStore().saveImage(bytes, type, me.id))
  }
  const post = await createPostWithTranslation(flowDeps(), {
    board: board.id, authorId: me.id, title, body, lang: me.lang, images,
    anonymous: !!board.anonOnly || f.get('anonymous') === 'on',
  })
  redirect(`/post/${post.id}`)
}

export async function submitComment(postId: string, f: FormData) {
  const me = await requireUser()
  if (blockedBySanction(me)) return
  const id = Id.safeParse(postId)
  if (!id.success) return
  const store = getStore()
  const body = cleanInput(f.get('body'), LIMITS.comment, true)
  const post = await store.getPost(id.data)
  if (!post || !body || !commentLimit(me.id)) return
  // 답글은 같은 글의 댓글에만, 대댓글의 답글은 맨 위 댓글에 붙인다(화면이 두 단계까지만 그린다)
  let parentId: string | null = null
  const rawParent = Id.safeParse(f.get('parentId'))
  if (rawParent.success) {
    const parent = await store.getComment(rawParent.data)
    if (!parent || parent.postId !== post.id) return
    parentId = parent.parentId ?? parent.id
  }
  const anonOnly = !!(await loadBoards(store, me.lang)).find(b => b.id === post.board)?.anonOnly
  await createCommentWithTranslation(flowDeps(), {
    postId: post.id, parentId, authorId: me.id, body, lang: me.lang,
    anonymous: anonOnly || f.get('anonymous') === 'on',
  })
  redirect(`/post/${post.id}`)
}

/**
 * 공감 켜기/끄기. want는 누른 사람이 원하는 상태라서 두 번 눌려 요청이 두 번 와도 결과가 같다.
 * 실시간 알림 토픽은 클라이언트가 준 값이 아니라 저장된 글 id로 정한다
 */
export async function like(kind: 'post' | 'comment', id: string, want: boolean) {
  const me = await requireUser()
  const args = z.tuple([Kind, Id, Want]).safeParse([kind, id, want])
  if (!args.success || !reactLimit(me.id)) return
  const [k, targetId, on] = args.data
  const store = getStore()
  const row = k === 'post' ? await store.getPost(targetId) : await store.getComment(targetId)
  if (!row) return
  if (row.likes.includes(me.id) !== on) await store.toggleLike(k, targetId, me.id)
  const postId = 'postId' in row ? row.postId : row.id
  await publish({ topic: `post:${postId}`, kind: 'like', id: targetId })
  refresh()
}

/** 스크랩 켜기/끄기(want로 멱등) */
export async function scrap(postId: string, want: boolean) {
  const me = await requireUser()
  const args = z.tuple([Id, Want]).safeParse([postId, want])
  if (!args.success || !reactLimit(me.id)) return
  const [id, on] = args.data
  const store = getStore()
  const post = await store.getPost(id)
  if (!post) return
  if (post.scraps.includes(me.id) !== on) await store.toggleScrap(id, me.id)
  refresh()
}

/** 글 삭제: 쓴 사람만 */
export async function removePost(postId: string) {
  const me = await requireUser()
  const id = Id.safeParse(postId)
  if (!id.success) return
  const store = getStore()
  const post = await store.getPost(id.data)
  if (!post || post.authorId !== me.id) return
  await store.deletePost(post.id)
  for (const topic of [`board:${post.board}`, 'board:all', `post:${post.id}`]) await publish({ topic, kind: 'del', id: post.id })
  redirect(`/board/${post.board}`)
}

/** 글 수정: 쓴 사람만. 제목·본문을 바꾸고 다시 번역·검수한다(사진은 그대로) */
export async function editPost(postId: string, f: FormData) {
  const me = await requireUser()
  if (blockedBySanction(me)) return
  const id = Id.safeParse(postId)
  if (!id.success) return
  const store = getStore()
  const post = await store.getPost(id.data)
  if (!post || post.authorId !== me.id || post.hidden) return
  const title = cleanInput(f.get('title'), LIMITS.title), body = cleanInput(f.get('body'), LIMITS.body, true)
  if (!title || !body || !postLimit(me.id)) return
  await store.updatePost(post.id, { title, body, lang: me.lang })
  const topics = [`board:${post.board}`, 'board:all', `post:${post.id}`]
  // 화면을 보고 있는 사람에게 바뀐 글을 바로 다시 그리게 한다(번역이 붙을 때와 같은 신호)
  for (const topic of topics) await publish({ topic, kind: 'tr', id: post.id })
  translateLater(flowDeps(), 'post', post.id, { title, body }, topics, undefined, me.lang)
  moderateLater(flowDeps(), 'post', post.id)
  redirect(`/post/${post.id}`)
}

/** 게시판 삭제: 학생이 만든 게시판을 만든 사람만. 안의 글·댓글도 함께 지운다 */
export async function removeBoard(boardId: string) {
  const me = await requireUser()
  const id = Id.safeParse(boardId)
  if (!id.success) return
  const store = getStore()
  const board = (await store.listBoards()).find(b => b.id === id.data)
  if (!board || board.ownerId !== me.id) return
  await store.deleteBoard(board.id)
  for (const topic of [`board:${board.id}`, 'board:all']) await publish({ topic, kind: 'del', id: board.id })
  // 내 고정 목록에서도 뺀다(다른 사람 목록의 옛 id는 화면이 없는 게시판으로 걸러 낸다)
  const pins = pinsOf(me)
  if (pins.includes(board.id)) await store.updateProfile(me.id, { pins: pins.filter(p => p !== board.id) })
  redirect('/boards')
}

/**
 * 글·댓글 신고:내 글·댓글은 안 되고, 같은 글·댓글은 한 번만(사람당 횟수 제한). 받은 뒤 응답 뒤에 AI가 검수해
 * 위반이면 가리고 작성자에게 경고·이용 제한. 결과는 글 화면 ?reported= 로 알린다
 */
export async function reportContent(kind: 'post' | 'comment', targetId: string, f: FormData) {
  const me = await requireUser()
  const args = z.tuple([Kind, Id]).safeParse([kind, targetId])
  if (!args.success) return
  const [k, id] = args.data
  const store = getStore()
  const row = k === 'post' ? await store.getPost(id) : await store.getComment(id)
  if (!row) return
  const postId = 'postId' in row ? row.postId : row.id
  const back = (r: ReportResult): never => redirect(`/post/${encodeURIComponent(postId)}?reported=${r}`)
  if (row.authorId === me.id) back('own')
  const reason = Reason.safeParse(f.get('reason'))
  if (!reason.success) redirect(`/post/${encodeURIComponent(postId)}`)
  if (!reportLimit(me.id)) back('limit')
  let saved
  try {
    saved = await store.createReport({ reporterId: me.id, kind: k, targetId: id, authorId: row.authorId, reason: reason.data, detail: cleanInput(f.get('detail'), REPORT_DETAIL_MAX, true) })
  } catch (e) {
    console.warn('[reportContent]', e instanceof Error ? e.message : e)
    back('fail')
  }
  if (!saved) back('dup')
  moderateLater(flowDeps(), k, id)
  back('ok')
}

/** 홈 "즐겨찾는 게시판"에 고정하거나 뺀다(있는 게시판만). want가 오면 그 상태로 맞춘다(두 번 눌림에 안전) */
export async function togglePinBoard(boardId: string, want?: boolean) {
  const me = await requireUser()
  const args = z.tuple([Id, Want.optional()]).safeParse([boardId, want])
  if (!args.success) return
  const [id, on] = args.data
  const store = getStore()
  if (!(await loadBoards(store, me.lang)).some(b => b.id === id)) return
  const pins = pinsOf(me)
  if (on !== undefined && pins.includes(id) === on) return refresh()
  await store.updateProfile(me.id, { pins: togglePin(pins, id) })
  refresh()
}

/** 새 게시판: 만든 사람 언어로 저장하고, 응답 뒤 다른 언어로 번역. 만든 사람 홈에 바로 고정 */
export async function createBoard(f: FormData) {
  const me = await requireUser()
  const name = cleanInput(f.get('name'), LIMITS.boardName), desc = cleanInput(f.get('desc'), LIMITS.boardDesc)
  if (!name || !boardLimit(me.id)) return
  const store = getStore()
  const board = await store.createBoard({ name, desc, lang: me.lang, ownerId: me.id })
  translateLater(flowDeps(), 'board', board.id, desc ? { name, desc } : { name }, ['board:all'])
  const pins = pinsOf(me)
  if (!pins.includes(board.id)) await store.updateProfile(me.id, { pins: [...pins, board.id] })
  redirect(`/board/${board.id}`)
}

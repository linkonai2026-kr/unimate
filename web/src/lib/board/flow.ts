// 글·댓글·쪽지·평가를 저장하고, 응답 후에 번역해 다시 알리는 공통 흐름과 화면용 변환
import { t, type Lang } from '../i18n'
import type { NewComment, NewPost, Store, TrKind } from '../store/types'
import { pickText } from '../text'
import type { Comment, LiveEvent, Message, Post, TrMap } from '../types'

export interface FlowDeps {
  store: Store
  /** context: 앞선 대화 줄(참고용, 번역하지 않음) */
  translate: (fields: Record<string, string>, context?: string[]) => Promise<{ detected: Lang; tr: TrMap }>
  publish: (e: LiveEvent) => Promise<void>
  /** 응답을 보낸 뒤 실행(서버 액션에서는 next/server의 after) */
  defer: (fn: () => Promise<void>) => void
}

/**
 * 폼 값 정리: 문자열이 아니면 빈 값, NUL·제어 문자 제거(Postgres text가 거부), 앞뒤 공백 제거,
 * 한 줄 칸은 줄바꿈을 공백으로, 길이 상한에서 자르되 이모지 반쪽(외톨이 서로게이트)은 남기지 않는다
 */
export function cleanInput(v: unknown, max: number, multiline = false): string {
  if (typeof v !== 'string') return ''
  let s = v.replace(/\r\n?/g, '\n')
  s = multiline ? s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '') : s.replace(/[\u0000-\u001f\u007f]+/g, ' ')
  s = s.trim().slice(0, max)
  return s.replace(/[\ud800-\udbff]$/, '').trim()
}

/** 응답 뒤에 번역 → 저장 → 'tr' 이벤트. 실패하면 원문 그대로 둔다(“번역 중” 표시는 1분 뒤 사라짐) */
export function translateLater(d: FlowDeps, kind: TrKind, id: string, fields: Record<string, string>, topics: string[], context: () => Promise<string[]> = async () => []) {
  if (!Object.values(fields).some(v => v.trim())) return
  d.defer(async () => {
    try {
      const { detected, tr } = await d.translate(fields, await context())
      await d.store.setTr(kind, id, tr, detected)
      await Promise.all(topics.map(topic => d.publish({ topic, kind: 'tr', id })))
    } catch (e) {
      console.warn(`[translateLater] ${kind} ${id}:`, e instanceof Error ? e.message : e)
    }
  })
}

export async function createPostWithTranslation(d: FlowDeps, input: NewPost): Promise<Post> {
  const post = await d.store.createPost(input)
  const topics = [`board:${post.board}`, 'board:all']
  for (const topic of topics) await d.publish({ topic, kind: 'new', id: post.id })
  translateLater(d, 'post', post.id, { title: post.title, body: post.body }, [...topics, `post:${post.id}`])
  return post
}

export async function createCommentWithTranslation(d: FlowDeps, input: NewComment): Promise<Comment> {
  const c = await d.store.createComment(input)
  const topic = `post:${c.postId}`
  await d.publish({ topic, kind: 'new', id: c.id })
  translateLater(d, 'comment', c.id, { body: c.body }, [topic], async () => {
    const [post, all] = await Promise.all([d.store.getPost(c.postId), d.store.listComments(c.postId)])
    const idx = all.findIndex(x => x.id === c.id)
    return commentContext(post, idx > 0 ? all.slice(0, idx) : [])
  })
  return c
}

/** 문맥 한 줄 길이·줄 수 상한(비용과 지연을 작게) */
const CTX_LINE = 300
const CTX_LINES = 6
const clip = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, CTX_LINE)
const lastN = <T>(xs: T[], n: number) => (n > 0 ? xs.slice(-n) : [])

/** 댓글 문맥: 원글 제목·본문 + 바로 앞 댓글들(작성자 정보는 넣지 않는다) */
export function commentContext(post: Post | null, before: Comment[]): string[] {
  const head = post ? [`Post title: ${clip(post.title)}`, `Post: ${clip(post.body)}`] : []
  return [...head, ...lastN(before, CTX_LINES - head.length).map(x => `Comment: ${clip(x.body)}`)]
}

/** 쪽지 문맥: 새 쪽지 바로 앞 대화 최대 6개. 보낸 사람 기준 Sender/Other(이름은 넣지 않는다) */
export function messageContext(history: Message[], current: Message): string[] {
  const idx = history.findIndex(m => m.id === current.id)
  return lastN(idx >= 0 ? history.slice(0, idx) : history, CTX_LINES).map(m => `${m.fromId === current.fromId ? 'Sender' : 'Other'}: ${clip(m.body)}`)
}

/** 방금 올라와 아직 번역이 안 붙은 글인지(“번역 중” 표시용) */
export const PENDING_MS = 60_000
export const isPending = (item: { tr: TrMap; createdAt: number }) => Object.keys(item.tr).length === 0 && Date.now() - item.createdAt < PENDING_MS

type Author = { nickname: string; nationality: string; avatar?: number; photo?: string | null }
type Ctx = { viewer: Lang; viewerId: string; author: Author | null }

/** 화면에 내보낼 작성자 정보. 익명이면 닉네임·그림·사진을 절대 담지 않는다(국기만) */
function authorOf(anonymous: boolean, ctx: Ctx) {
  const named = !anonymous && ctx.author ? ctx.author : null
  return {
    author: named ? named.nickname : t(ctx.viewer, 'anonymous'),
    nation: ctx.author?.nationality ?? 'XX',
    avatar: named ? (named.avatar ?? 0) : null,
    photo: named ? (named.photo ?? null) : null,
  }
}

export function toPostView(p: Post, ctx: Ctx & { comments: number }) {
  const title = pickText(p, 'title', p.title, ctx.viewer)
  const body = pickText(p, 'body', p.body, ctx.viewer)
  return {
    id: p.id, board: p.board, from: p.lang, createdAt: p.createdAt,
    title: title.text, body: body.text, originalTitle: p.title, originalBody: p.body,
    translated: title.translated || body.translated, pending: ctx.viewer !== p.lang && isPending(p),
    ...authorOf(p.anonymous, ctx),
    images: p.images ?? [],
    likes: p.likes.length, liked: p.likes.includes(ctx.viewerId),
    scraps: p.scraps.length, scraped: p.scraps.includes(ctx.viewerId),
    comments: ctx.comments,
  }
}
export type PostView = ReturnType<typeof toPostView>

/** 에타식 익명 번호: 글쓴이를 뺀 익명 댓글 작성자에게 처음 댓글 단 순서대로 1, 2, … */
export function anonNumbers(postAuthorId: string, comments: { authorId: string; anonymous: boolean }[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of comments) if (c.anonymous && c.authorId !== postAuthorId && !out.has(c.authorId)) out.set(c.authorId, out.size + 1)
  return out
}

export function toCommentView(c: Comment, ctx: Ctx & { isPostAuthor: boolean; anonNo?: number }) {
  const body = pickText(c, 'body', c.body, ctx.viewer)
  const who = authorOf(c.anonymous, ctx)
  const writer = t(ctx.viewer, 'writer')
  if (c.anonymous) who.author = ctx.isPostAuthor ? `${t(ctx.viewer, 'anonymous')}(${writer})` : `${t(ctx.viewer, 'anonymous')}${ctx.anonNo ?? ''}`
  else if (ctx.isPostAuthor) who.author = `${who.author}(${writer})`
  return {
    id: c.id, parentId: c.parentId, from: c.lang, createdAt: c.createdAt,
    body: body.text, originalBody: c.body, translated: body.translated, pending: ctx.viewer !== c.lang && isPending(c),
    ...who, isPostAuthor: ctx.isPostAuthor,
    likes: c.likes.length, liked: c.likes.includes(ctx.viewerId), mine: c.authorId === ctx.viewerId,
  }
}
export type CommentView = ReturnType<typeof toCommentView>

// 메모리·Supabase 스토어가 함께 구현하는 데이터 접근 인터페이스와 두 구현이 똑같이 쓰는 규칙
import { createHash } from 'node:crypto'
import type { ImageType } from '../images'
import type { CatalogCourse } from '../timetable/catalog'
import type { GradeSemester } from '../timetable/grades'
import type { Board, Comment, Course, Lang, Message, Post, Profile, Review, Table, TrMap } from '../types'

export type NewPost = Pick<Post, 'board' | 'authorId' | 'anonymous' | 'title' | 'body' | 'lang'> & { images?: string[] }
export type NewComment = Pick<Comment, 'postId' | 'parentId' | 'authorId' | 'anonymous' | 'body' | 'lang'>
export type NewCourse = Omit<Course, 'id' | 'userId' | 'tableId'>
export type NewReview = Pick<Review, 'courseName' | 'professor' | 'authorId' | 'rating' | 'fields' | 'body' | 'lang'>
export type NewMessage = Pick<Message, 'fromId' | 'toId' | 'body' | 'lang'>
export type NewProfile = Omit<Profile, 'id' | 'createdAt'>
export type ProfilePatch = Partial<Pick<Profile, 'nickname' | 'lang' | 'nationality' | 'avatar' | 'major' | 'year' | 'passHash' | 'photo' | 'pins'>>
export type TrKind = 'post' | 'comment' | 'review' | 'message' | 'board'
export type NewBoard = Pick<Board, 'name' | 'desc' | 'lang' | 'ownerId'>

export interface PostQuery {
  board?: string
  /** 공감 HOT_MIN 이상 */
  hot?: boolean
  /** 공감 많은 순 */
  best?: boolean
  query?: string
  authorId?: string
  scrapBy?: string
  commentedBy?: string
  limit?: number
}

/** 목록 기본 개수 */
export const DEFAULT_LIMIT = 50
/** HOT·BEST는 최근 글 이만큼 안에서 고른다(ponytail: 글이 많아지면 likes 개수 컬럼과 인덱스를 둔다) */
export const SCAN_LIMIT = 300
/** 대화 하나·대화 목록에서 읽는 최근 쪽지 수 */
export const MESSAGE_LIMIT = 1000
/** 새 학기 시간표를 처음 열 때 만드는 기본 시간표 이름 */
export const DEFAULT_TABLE_NAME = '시간표 1'

/** 같은 사용자·학기의 기본 시간표 id는 항상 같다(동시에 두 번 열어도 하나만 생긴다) */
export const defaultTableId = (userId: string, sem: string) =>
  `t-${createHash('sha256').update(`${userId}\u0000${sem}`).digest('hex').slice(0, 24)}`

/**
 * 검색어 정리: LIKE 와일드카드·PostgREST 필터 구분 문자를 공백으로 바꾸고 공백을 하나로.
 * 두 스토어가 같은 규칙으로 찾게 한다. 남는 게 없으면 null(검색 조건 없음)
 */
export function searchTerm(q: string | undefined): string | null {
  const term = (q ?? '').replace(/[%_*,()"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
  return term || null
}

/** 강의 입력에서 저장할 칸만(비어 있는 선택 칸은 뺀다). 두 스토어가 같은 모양으로 저장하게 */
export const pickCourse = (c: NewCourse): NewCourse => ({
  name: c.name, place: c.place, day: c.day, start: c.start, end: c.end,
  ...(c.code != null ? { code: c.code } : {}),
  ...(c.credit != null ? { credit: c.credit } : {}),
  ...(c.prof != null ? { prof: c.prof } : {}),
})

/** 쿼리 limit을 안전한 범위로 */
export const clampLimit = (n: number | undefined) =>
  Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n as number), 0), 300) : DEFAULT_LIMIT

export interface Store {
  listBoards(): Promise<Board[]>
  createBoard(b: NewBoard): Promise<Board>
  getProfile(id: string): Promise<Profile | null>
  getProfileByHandle(handle: string): Promise<Profile | null>
  listProfiles(): Promise<Profile[]>
  /** 같은 handle이 이미 있으면 던진다 */
  createProfile(p: NewProfile): Promise<Profile>
  updateProfile(id: string, patch: ProfilePatch): Promise<void>

  listPosts(q?: PostQuery): Promise<Post[]>
  getPost(id: string): Promise<Post | null>
  createPost(p: NewPost): Promise<Post>
  deletePost(id: string): Promise<void>
  setTr(kind: TrKind, id: string, tr: TrMap, detected: Lang): Promise<void>
  toggleLike(kind: 'post' | 'comment', id: string, userId: string): Promise<number>
  toggleScrap(postId: string, userId: string): Promise<boolean>

  saveImage(data: Uint8Array, type: ImageType, ownerId: string): Promise<string>
  getImage(id: string): Promise<{ data: Uint8Array; type: ImageType } | null>

  listComments(postId: string): Promise<Comment[]>
  getComment(id: string): Promise<Comment | null>
  createComment(c: NewComment): Promise<Comment>

  /** 이번 학기 기본 시간표의 강의(친구 매칭에 쓰임) */
  listCourses(userId: string): Promise<Course[]>
  /** 이번 학기 기본 시간표를 통째로 교체(캡처 등록) */
  replaceCourses(userId: string, courses: NewCourse[]): Promise<void>
  /** 학기의 시간표 목록(만든 순). 없으면 기본 시간표 하나를 만든다 */
  listTables(userId: string, sem: string): Promise<Table[]>
  getTable(id: string): Promise<Table | null>
  createTable(userId: string, sem: string, name: string): Promise<Table>
  updateTable(id: string, patch: Partial<Pick<Table, 'name' | 'colors'>>): Promise<void>
  setPrimary(id: string): Promise<void>
  /** 학기의 마지막 시간표는 지우지 않는다 */
  deleteTable(id: string): Promise<void>
  listTableCourses(tableId: string): Promise<Course[]>
  replaceTableCourses(tableId: string, courses: NewCourse[]): Promise<void>

  listCatalog(): Promise<CatalogCourse[]>
  addCatalog(list: CatalogCourse[]): Promise<void>
  getGrades(userId: string): Promise<GradeSemester[]>
  setGrades(userId: string, sems: GradeSemester[]): Promise<void>

  listFriends(userId: string): Promise<Profile[]>
  addFriend(a: string, b: string): Promise<void>
  /** 친구 요청. 상대가 이미 나에게 요청했으면 바로 친구('accepted'), 이미 친구면 'already' */
  requestFriend(from: string, to: string): Promise<'sent' | 'accepted' | 'already'>
  /** 나에게 온 요청(보낸 사람 프로필)과 내가 보낸 요청(받는 사람 id) */
  listRequests(userId: string): Promise<{ incoming: Profile[]; outgoing: string[] }>
  /** from이 나에게 보낸 요청을 수락·거절. 요청이 없으면 아무 일도 없다 */
  respondFriend(me: string, from: string, accept: boolean): Promise<void>

  /** 두 사람의 최근 쪽지(오래된 순, 최대 MESSAGE_LIMIT개) */
  listMessages(a: string, b: string): Promise<Message[]>
  getMessage(id: string): Promise<Message | null>
  /** 대화 상대별 마지막 쪽지(최근 대화 순) */
  listThreads(userId: string): Promise<{ other: Profile; last: Message }[]>
  createMessage(m: NewMessage): Promise<Message>

  listReviews(courseName?: string): Promise<Review[]>
  getReview(id: string): Promise<Review | null>
  createReview(r: NewReview): Promise<Review>
}

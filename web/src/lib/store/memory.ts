// 키 없이 돌아가는 서버 메모리 스토어(로컬·발표장 예비용). 넣고 꺼내는 값은 복사본이라 호출한 쪽이 고쳐도 저장값은 그대로다
import { randomUUID } from 'node:crypto'
import { HOT_MIN } from '../boards'
import type { ImageType } from '../images'
import type { CatalogCourse } from '../timetable/catalog'
import type { GradeSemester } from '../timetable/grades'
import { CURRENT_SEM } from '../timetable/sem'
import { nextSuspension, WARNING_LIMIT } from '../moderation'
import type { Board, Comment, Course, Lang, Message, Post, Profile, Report, Review, Table, TrMap } from '../types'
import { seedData } from './seed'
import {
  clampLimit, DEFAULT_TABLE_NAME, defaultTableId, MESSAGE_LIMIT, pickCourse, SCAN_LIMIT, searchTerm,
  type NewCourse, type Store, type TrKind,
} from './types'

export interface MemoryData {
  profiles: Profile[]
  posts: Post[]
  comments: Comment[]
  courses: Course[]
  tables: Table[]
  catalog: CatalogCourse[]
  grades: Record<string, GradeSemester[]>
  images: { id: string; type: ImageType; data: Uint8Array; ownerId: string }[]
  friends: [string, string][]
  /** [보낸 사람, 받는 사람] */
  requests: [string, string][]
  messages: Message[]
  reviews: Review[]
  boards: Board[]
  reports: Report[]
}

const empty = (): MemoryData => ({ profiles: [], posts: [], comments: [], courses: [], tables: [], catalog: [], grades: {}, images: [], friends: [], requests: [], messages: [], reviews: [], boards: [], reports: [] })
const newest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt
const oldest = <T extends { createdAt: number }>(a: T, b: T) => a.createdAt - b.createdAt
const copy = <T>(v: T): T => structuredClone(v)
/** undefined 값은 빼고(Supabase도 JSON으로 보내면서 빠진다) */
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
const between = (m: Message, a: string, b: string) => (m.fromId === a && m.toId === b) || (m.fromId === b && m.toId === a)
/** profiles 표에 있는 열(supabase/schema.sql). 가입 정보에 다른 키가 섞이면 Supabase처럼 거절한다 */
const PROFILE_KEYS = new Set(['handle', 'nickname', 'nationality', 'lang', 'passHash', 'avatar', 'major', 'year', 'photo', 'pins', 'violations', 'suspendedUntil', 'sanctionReason'])

// ponytail: 매 호출 배열 전체 순회. 데모 규모(수백 건)면 충분, 커지면 Supabase 스토어를 쓴다
export function createMemoryStore(seed = true): Store {
  const d = seed ? seedData() : empty()
  // 사용자 id가 "__proto__"여도 객체 원형을 건드리지 않게
  d.grades = Object.assign(Object.create(null) as Record<string, GradeSemester[]>, d.grades)
  // 같은 밀리초에 연달아 만들어도 순서가 유지되게
  let last = 0
  const now = () => (last = Math.max(Date.now(), last + 1))

  const rowsOf = (kind: TrKind): { id: string; tr: TrMap; lang: Lang }[] =>
    ({ post: d.posts, comment: d.comments, review: d.reviews, message: d.messages, board: d.boards })[kind]

  function tablesOf(userId: string, sem: string): Table[] {
    const mine = () => d.tables.filter(t => t.userId === userId && t.sem === sem)
    if (!mine().length) d.tables.push({ id: defaultTableId(userId, sem), userId, sem, name: DEFAULT_TABLE_NAME, primary: true, colors: {}, createdAt: now() })
    return mine().sort(oldest)
  }
  const primaryOf = (userId: string) => {
    const list = tablesOf(userId, CURRENT_SEM)
    return list.find(t => t.primary) ?? list[0]
  }
  const replaceIn = (t: Table, courses: NewCourse[]) => {
    const rows: Course[] = courses.map(c => ({ ...pickCourse(c), id: randomUUID(), userId: t.userId, tableId: t.id }))
    d.courses = d.courses.filter(c => c.tableId !== t.id).concat(rows)
  }

  const friendIds = (userId: string) => d.friends.flatMap(([a, b]) => (a === userId ? [b] : b === userId ? [a] : []))
  const areFriends = (a: string, b: string) => d.friends.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
  const hasRequest = (from: string, to: string) => d.requests.some(([f, t]) => f === from && t === to)
  const addFriend = (a: string, b: string) => {
    if (a === b) return
    // 친구가 되면 둘 사이에 남은 요청은 정리한다
    d.requests = d.requests.filter(([f, t]) => !((f === a && t === b) || (f === b && t === a)))
    if (!areFriends(a, b)) d.friends.push([a, b])
  }
  const respondFriend = (me: string, from: string, accept: boolean) => {
    const had = hasRequest(from, me)
    d.requests = d.requests.filter(([f, t]) => !(f === from && t === me))
    if (had && accept) addFriend(me, from)
  }
  const profilesIn = (ids: string[]) => {
    const set = new Set(ids)
    return copy(d.profiles.filter(p => set.has(p.id)).sort(oldest))
  }

  return {
    async getProfile(id) { return copy(d.profiles.find(p => p.id === id) ?? null) },
    async getProfileByHandle(handle) { return copy(d.profiles.find(p => p.handle === handle) ?? null) },
    async listProfiles() { return copy([...d.profiles].sort(oldest)) },
    async createProfile(p) {
      // Supabase가 없는 열(PGRST204)을 거절하는 것과 같게: 예를 들어 평문 password가 섞여 들어오면 저장하지 않는다
      const unknown = Object.keys(p).filter(k => !PROFILE_KEYS.has(k))
      if (unknown.length) throw new Error(`memory: unknown profile field ${unknown.join(', ')}`)
      // Supabase의 handle unique 제약과 같게
      if (d.profiles.some(x => x.handle === p.handle)) throw new Error('memory: handle already exists')
      const row: Profile = { ...copy(defined(p)), id: randomUUID(), createdAt: now() } as Profile
      d.profiles.push(row)
      return copy(row)
    },
    async updateProfile(id, patch) {
      const p = d.profiles.find(x => x.id === id)
      if (p) Object.assign(p, copy(defined(patch)))
    },

    async listPosts(q = {}) {
      const term = searchTerm(q.query)?.toLowerCase()
      const commented = q.commentedBy ? new Set(d.comments.filter(c => c.authorId === q.commentedBy).map(c => c.postId)) : null
      // 검색은 제목·본문과 각 언어 번역의 제목·본문을 필드마다 본다(Supabase의 ilike와 같게)
      const matches = (p: Post) => !term || [p.title, p.body, ...Object.values(p.tr).flatMap(f => [f?.title, f?.body])]
        .some(s => typeof s === 'string' && s.toLowerCase().includes(term))
      // 규칙 위반으로 가려진 글은 어느 목록·검색에도 나오지 않는다
      let list = d.posts.filter(p =>
        !p.hidden &&
        (!q.board || p.board === q.board) &&
        (!q.authorId || p.authorId === q.authorId) &&
        (!q.scrapBy || p.scraps.includes(q.scrapBy)) &&
        (!commented || commented.has(p.id)) &&
        matches(p)).sort(newest)
      if (q.hot || q.best) list = list.slice(0, SCAN_LIMIT)
      if (q.hot) list = list.filter(p => p.likes.length >= HOT_MIN)
      if (q.best) list.sort((a, b) => b.likes.length - a.likes.length || newest(a, b))
      return copy(list.slice(0, clampLimit(q.limit)))
    },
    async getPost(id) { return copy(d.posts.find(p => p.id === id) ?? null) },
    async createPost(p) {
      const row: Post = {
        id: randomUUID(), board: p.board, authorId: p.authorId, anonymous: p.anonymous, title: p.title, body: p.body, lang: p.lang,
        tr: {}, likes: [], scraps: [], images: [...(p.images ?? [])], createdAt: now(),
      }
      d.posts.push(row)
      return copy(row)
    },
    async deletePost(id) {
      d.posts = d.posts.filter(p => p.id !== id)
      d.comments = d.comments.filter(c => c.postId !== id)
    },
    async updatePost(id, patch) {
      const row = d.posts.find(p => p.id === id)
      if (row) Object.assign(row, { title: patch.title, body: patch.body, lang: patch.lang, tr: {} })
    },
    async setTr(kind, id, tr, detected) {
      const row = rowsOf(kind).find(x => x.id === id)
      if (row) Object.assign(row, { tr: copy(tr), lang: detected })
    },
    async toggleLike(kind, id, userId) {
      const row = (kind === 'post' ? d.posts : d.comments).find(x => x.id === id)
      if (!row) return 0
      row.likes = row.likes.includes(userId) ? row.likes.filter(u => u !== userId) : [...row.likes, userId]
      return row.likes.length
    },
    async toggleScrap(postId, userId) {
      const p = d.posts.find(x => x.id === postId)
      if (!p) return false
      const on = !p.scraps.includes(userId)
      p.scraps = on ? [...p.scraps, userId] : p.scraps.filter(u => u !== userId)
      return on
    },

    // ponytail: 사진을 프로세스 메모리에 둔다(재시작하면 사라짐). 실서비스는 Supabase 스토어가 DB에 둔다
    async saveImage(data, type, ownerId) {
      const id = randomUUID()
      d.images.push({ id, type, data: new Uint8Array(data), ownerId })
      return id
    },
    async getImage(id) {
      const img = d.images.find(i => i.id === id)
      return img ? { data: new Uint8Array(img.data), type: img.type } : null
    },

    async listComments(postId) { return copy(d.comments.filter(c => c.postId === postId).sort(oldest)) },
    async getComment(id) { return copy(d.comments.find(c => c.id === id) ?? null) },
    async createComment(c) {
      const row: Comment = {
        id: randomUUID(), postId: c.postId, parentId: c.parentId, authorId: c.authorId, anonymous: c.anonymous, body: c.body, lang: c.lang,
        tr: {}, likes: [], createdAt: now(),
      }
      d.comments.push(row)
      return copy(row)
    },

    async listCourses(userId) {
      const t = primaryOf(userId)
      return copy(d.courses.filter(c => c.tableId === t.id))
    },
    async replaceCourses(userId, courses) { replaceIn(primaryOf(userId), courses) },
    async listTables(userId, sem) { return copy(tablesOf(userId, sem)) },
    async getTable(id) { return copy(d.tables.find(t => t.id === id) ?? null) },
    async createTable(userId, sem, name) {
      tablesOf(userId, sem)
      const row: Table = { id: randomUUID(), userId, sem, name, primary: false, colors: {}, createdAt: now() }
      d.tables.push(row)
      return copy(row)
    },
    async updateTable(id, patch) {
      const t = d.tables.find(x => x.id === id)
      if (t) Object.assign(t, copy(defined(patch)))
    },
    async setPrimary(id) {
      const t = d.tables.find(x => x.id === id)
      if (t) for (const x of d.tables) if (x.userId === t.userId && x.sem === t.sem) x.primary = x.id === id
    },
    async deleteTable(id) {
      const t = d.tables.find(x => x.id === id)
      if (!t) return
      const siblings = tablesOf(t.userId, t.sem)
      if (siblings.length <= 1) return
      d.tables = d.tables.filter(x => x.id !== id)
      d.courses = d.courses.filter(c => c.tableId !== id)
      const heir = siblings.find(x => x.id !== id)
      if (t.primary && heir) heir.primary = true
    },
    async listTableCourses(tableId) { return copy(d.courses.filter(c => c.tableId === tableId)) },
    async replaceTableCourses(tableId, courses) {
      const t = d.tables.find(x => x.id === tableId)
      if (t) replaceIn(t, courses)
    },

    async listCatalog() { return copy(d.catalog) },
    async addCatalog(list) {
      for (const c of list) if (!d.catalog.some(x => x.code === c.code)) d.catalog.push(copy(c))
    },
    async getGrades(userId) { return copy(d.grades[userId] ?? []) },
    async setGrades(userId, sems) { d.grades[userId] = copy(sems) },

    async listFriends(userId) { return profilesIn(friendIds(userId)) },
    async addFriend(a, b) { addFriend(a, b) },
    async requestFriend(from, to) {
      if (from === to || areFriends(from, to)) return 'already'
      if (hasRequest(to, from)) {
        respondFriend(from, to, true)
        return 'accepted'
      }
      if (!hasRequest(from, to)) d.requests.push([from, to])
      return 'sent'
    },
    async listRequests(userId) {
      return {
        incoming: profilesIn(d.requests.filter(([, t]) => t === userId).map(([f]) => f)),
        outgoing: d.requests.filter(([f]) => f === userId).map(([, t]) => t),
      }
    },
    async respondFriend(me, from, accept) { respondFriend(me, from, accept) },

    async listMessages(a, b) { return copy(d.messages.filter(m => between(m, a, b)).sort(oldest).slice(-MESSAGE_LIMIT)) },
    async getMessage(id) { return copy(d.messages.find(m => m.id === id) ?? null) },
    async listThreads(userId) {
      // 최근 쪽지부터 보며 상대별 첫 쪽지(=마지막 쪽지)만 남긴다
      const recent = d.messages.filter(m => m.fromId === userId || m.toId === userId).sort(newest).slice(0, MESSAGE_LIMIT)
      const lastBy = new Map<string, Message>()
      for (const m of recent) {
        const other = m.fromId === userId ? m.toId : m.fromId
        if (!lastBy.has(other)) lastBy.set(other, m)
      }
      return [...lastBy].flatMap(([id, last]) => {
        const other = d.profiles.find(p => p.id === id)
        return other ? [copy({ other, last })] : []
      })
    },
    async createMessage(m) {
      const row: Message = { id: randomUUID(), fromId: m.fromId, toId: m.toId, body: m.body, lang: m.lang, tr: {}, createdAt: now() }
      d.messages.push(row)
      return copy(row)
    },

    async listReviews(courseName) { return copy(d.reviews.filter(r => !courseName || r.courseName === courseName).sort(newest)) },
    async getReview(id) { return copy(d.reviews.find(r => r.id === id) ?? null) },
    async createReview(r) {
      const row: Review = {
        id: randomUUID(), courseName: r.courseName, professor: r.professor, authorId: r.authorId, rating: r.rating,
        fields: copy(r.fields), body: r.body, lang: r.lang, tr: {}, createdAt: now(),
      }
      d.reviews.push(row)
      return copy(row)
    },

    async createReport(r) {
      // Supabase의 (reporterId, kind, targetId) unique 제약과 같게
      if (d.reports.some(x => x.reporterId === r.reporterId && x.kind === r.kind && x.targetId === r.targetId)) return null
      const row: Report = { id: randomUUID(), reporterId: r.reporterId, kind: r.kind, targetId: r.targetId, authorId: r.authorId, reason: r.reason, detail: r.detail, status: 'pending', createdAt: now() }
      d.reports.push(row)
      return copy(row)
    },
    async listReports(kind, targetId) { return copy(d.reports.filter(r => r.kind === kind && r.targetId === targetId).sort(oldest)) },
    async resolveReports(kind, targetId, status) {
      for (const r of d.reports) if (r.kind === kind && r.targetId === targetId && r.status === 'pending') r.status = status
    },
    // 한 번의 동기 실행이라 중간에 다른 요청이 끼지 않는다(Supabase는 apply_violation 함수 하나로 같은 일을 한다)
    async applyViolation(kind, id, rule, at) {
      const row = (kind === 'post' ? d.posts : d.comments).find(x => x.id === id)
      if (!row || row.hidden) return null
      row.hidden = true
      const author = d.profiles.find(p => p.id === row.authorId)
      if (!author) return { authorId: row.authorId, violations: 0, suspendedUntil: null }
      const violations = (author.violations ?? 0) + 1
      const until = nextSuspension(violations, at, author.suspendedUntil)
      author.violations = violations
      if (violations > WARNING_LIMIT) Object.assign(author, { suspendedUntil: until, sanctionReason: rule })
      return { authorId: author.id, violations, suspendedUntil: until }
    },

    async listBoards() { return copy([...d.boards].sort(oldest)) },
    async createBoard(b) {
      const row: Board = { id: randomUUID(), name: b.name, desc: b.desc, lang: b.lang, ownerId: b.ownerId, tr: {}, createdAt: now() }
      d.boards.push(row)
      return copy(row)
    },
    async deleteBoard(id) {
      const gone = new Set(d.posts.filter(p => p.board === id).map(p => p.id))
      d.comments = d.comments.filter(c => !gone.has(c.postId))
      d.posts = d.posts.filter(p => p.board !== id)
      d.boards = d.boards.filter(b => b.id !== id)
    },
  }
}

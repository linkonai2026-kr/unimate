// Supabase(Postgres) 스토어: 메모리 스토어와 같은 Store 계약을 서버(service role) 권한으로 구현
import { randomUUID } from 'node:crypto'
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { HOT_MIN } from '../boards'
import { LANGS } from '../i18n'
import type { ImageType } from '../images'
import type { CatalogCourse } from '../timetable/catalog'
import type { GradeSemester } from '../timetable/grades'
import { CURRENT_SEM } from '../timetable/sem'
import type { Board, Comment, Course, Message, Post, Profile, Review, Table } from '../types'
import {
  clampLimit, DEFAULT_TABLE_NAME, defaultTableId, MESSAGE_LIMIT, pickCourse, SCAN_LIMIT, searchTerm,
  type NewCourse, type Store, type TrKind,
} from './types'

type R<T> = { data: T | null; error: PostgrestError | null }
/** Supabase 응답에서 오류면 던지고, 아니면 데이터 */
function must<T>({ data, error }: R<T>): T {
  if (error) throw new Error(`supabase: ${error.message}`, { cause: error })
  return data as T
}
const rows = <T>(r: R<T[]>): T[] => must(r) ?? []
const one = <T>(r: R<T[]>): T | null => rows(r)[0] ?? null
const unique = <T>(list: T[]) => [...new Set(list)]
/** Postgres의 null(비어 있는 선택 칸)을 빼서 메모리 스토어와 같은 모양으로 */
const tidy = <T extends object>(row: T): T => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T
/** or() 필터 문자열에 그대로 넣어도 되는 id인지(서버가 만든 uuid·시드 id만 통과) */
const safeId = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id)

const TABLE: Record<TrKind, string> = { post: 'posts', comment: 'comments', review: 'reviews', message: 'messages', board: 'boards' }
/** 검색 대상: 원문 제목·본문과 언어별 번역의 제목·본문 */
const SEARCH_COLUMNS = ['title', 'body', ...LANGS.flatMap(l => [`tr->${l.code}->>title`, `tr->${l.code}->>body`])]

function defaultClient(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    // 한 렌더 안에서 같은 GET을 다시 불러도 Next.js가 앞 결과를 돌려주지 않게(쓰고 바로 읽은 값이 옛것이 되지 않게) 요청마다 신호를 붙인다
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ?? new AbortController().signal }) },
  })
}

export function createSupabaseStore(client?: SupabaseClient): Store {
  const db = client ?? defaultClient()
  // 같은 밀리초에 연달아 만들어도 순서가 유지되게
  let last = 0
  const now = () => (last = Math.max(Date.now(), last + 1))

  /** Postgres 함수 호출. 함수가 없으면(스키마를 아직 다시 실행하지 않은 DB) 대신 fallback */
  let rpcMissing = false
  async function rpcOr<T>(fn: string, args: Record<string, unknown>, fallback: () => Promise<T>): Promise<T | null> {
    if (rpcMissing) return fallback()
    const { data, error } = await db.rpc(fn, args)
    if (!error) return data as T | null
    if (error.code === 'PGRST202' || error.code === '42883') {
      console.warn(`[supabase] ${fn} 함수가 없어 읽고-고쳐-쓰기로 대신합니다. supabase/schema.sql을 다시 실행하세요`)
      rpcMissing = true
      return fallback()
    }
    throw new Error(`supabase: ${error.message}`, { cause: error })
  }

  const profilesIn = async (ids: string[]): Promise<Profile[]> =>
    ids.length ? rows<Profile>(await db.from('profiles').select('*').in('id', unique(ids)).order('createdAt')).map(tidy) : []
  const tableById = async (id: string) => one<Table>(await db.from('tables').select('*').eq('id', id).limit(1))

  async function tablesOf(userId: string, sem: string): Promise<Table[]> {
    const list = rows<Table>(await db.from('tables').select('*').eq('userId', userId).eq('sem', sem).order('createdAt'))
    if (list.length) return list
    // 정해진 id로 넣어서 동시에 두 번 열어도 기본 시간표는 하나만 생긴다
    const id = defaultTableId(userId, sem)
    must(await db.from('tables').upsert({ id, userId, sem, name: DEFAULT_TABLE_NAME, primary: true, colors: {}, createdAt: now() }, { onConflict: 'id', ignoreDuplicates: true }))
    const made = await tableById(id)
    return made ? [made] : []
  }
  const primaryOf = async (userId: string) => {
    const list = await tablesOf(userId, CURRENT_SEM)
    return list.find(t => t.primary) ?? list[0] ?? null
  }
  // 시간표 강의 통째 교체: Postgres 함수 하나(한 트랜잭션, 시간표 행 잠금)로 지우고 넣는다.
  // 함수가 없는 DB면 새 강의를 먼저 넣고 옛 강의를 지운다(넣다가 실패해도 기존 시간표가 사라지지 않게)
  async function replaceIn(t: Table, courses: NewCourse[]) {
    await rpcOr('replace_table_courses', { p_table: t.id, p_courses: courses.map(pickCourse) }, async () => {
      const old = rows<{ id: string }>(await db.from('courses').select('id').eq('tableId', t.id)).map(r => r.id)
      if (courses.length) must(await db.from('courses').insert(courses.map(c => ({ ...pickCourse(c), id: randomUUID(), userId: t.userId, tableId: t.id }))))
      if (old.length) must(await db.from('courses').delete().in('id', old))
      return null
    })
  }

  const areFriends = async (a: string, b: string) => {
    const [x, y] = [a, b].sort()
    return !!one(await db.from('friends').select('a').eq('a', x).eq('b', y).limit(1))
  }
  const hasRequest = async (from: string, to: string) =>
    !!one(await db.from('friend_requests').select('from').eq('from', from).eq('to', to).limit(1))
  async function addFriend(a: string, b: string) {
    if (a === b) return
    // 친구가 되면 둘 사이에 남은 요청은 정리한다
    must(await db.from('friend_requests').delete().eq('from', a).eq('to', b))
    must(await db.from('friend_requests').delete().eq('from', b).eq('to', a))
    const [x, y] = [a, b].sort()
    must(await db.from('friends').upsert({ a: x, b: y }, { onConflict: 'a,b', ignoreDuplicates: true }))
  }
  async function respondFriend(me: string, from: string, accept: boolean) {
    const gone = rows(await db.from('friend_requests').delete().eq('from', from).eq('to', me).select('from'))
    if (gone.length && accept) await addFriend(me, from)
  }

  return {
    async getProfile(id) {
      const p = one<Profile>(await db.from('profiles').select('*').eq('id', id).limit(1))
      return p && tidy(p)
    },
    async getProfileByHandle(handle) {
      const p = one<Profile>(await db.from('profiles').select('*').eq('handle', handle).limit(1))
      return p && tidy(p)
    },
    async listProfiles() { return rows<Profile>(await db.from('profiles').select('*').order('createdAt')).map(tidy) },
    async createProfile(p) {
      const row = tidy({ ...p, id: randomUUID(), createdAt: now() }) as Profile
      // handle unique 제약에 걸리면 must가 던진다(메모리 스토어와 같게)
      must(await db.from('profiles').insert(row))
      return row
    },
    async updateProfile(id, patch) {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      if (Object.keys(clean).length) must(await db.from('profiles').update(clean).eq('id', id))
    },

    async listPosts(q = {}) {
      let query = db.from('posts').select('*')
      if (q.board) query = query.eq('board', q.board)
      if (q.authorId) query = query.eq('authorId', q.authorId)
      if (q.scrapBy) query = query.contains('scraps', [q.scrapBy])
      const term = searchTerm(q.query)
      // 값은 큰따옴표로 감싸 PostgREST가 . , ( ) : 같은 문자를 필터 문법으로 읽지 않게 한다(" \ % _ *는 searchTerm이 이미 뺐다)
      if (term) query = query.or(SEARCH_COLUMNS.map(c => `${c}.ilike."%${term}%"`).join(','))
      if (q.commentedBy) {
        // ponytail: 최근 댓글 300개의 글만 본다(주소 길이 한도). 더 필요하면 Postgres 함수(RPC)로 옮긴다
        const ids = unique(rows<{ postId: string }>(await db.from('comments').select('postId').eq('authorId', q.commentedBy).order('createdAt', { ascending: false }).limit(SCAN_LIMIT)).map(c => c.postId))
        if (!ids.length) return []
        query = query.in('id', ids)
      }
      const limit = clampLimit(q.limit)
      const scan = q.hot || q.best
      let list = rows<Post>(await query.order('createdAt', { ascending: false }).limit(scan ? SCAN_LIMIT : Math.max(limit, 1)))
      if (q.hot) list = list.filter(p => p.likes.length >= HOT_MIN)
      if (q.best) list = list.sort((a, b) => b.likes.length - a.likes.length || b.createdAt - a.createdAt)
      return list.slice(0, limit)
    },
    async getPost(id) { return one<Post>(await db.from('posts').select('*').eq('id', id).limit(1)) },
    async createPost(p) {
      const row: Post = {
        id: randomUUID(), board: p.board, authorId: p.authorId, anonymous: p.anonymous, title: p.title, body: p.body, lang: p.lang,
        tr: {}, likes: [], scraps: [], images: [...(p.images ?? [])], createdAt: now(),
      }
      must(await db.from('posts').insert(row))
      return row
    },
    async deletePost(id) {
      must(await db.from('comments').delete().eq('postId', id))
      must(await db.from('posts').delete().eq('id', id))
    },
    async setTr(kind, id, tr, detected) { must(await db.from(TABLE[kind]).update({ tr, lang: detected }).eq('id', id)) },
    // 공감·스크랩은 Postgres 함수(UPDATE 한 번)로 바꿔 같은 순간 두 번 눌러도 빠지지 않는다. 함수가 아직 없는 DB면 읽고-고쳐-쓰기로
    async toggleLike(kind, id, userId) {
      const fn = kind === 'post' ? 'toggle_post_like' : 'toggle_comment_like'
      const n = await rpcOr(fn, { p_id: id, p_user: userId }, async () => {
        const table = kind === 'post' ? 'posts' : 'comments'
        const row = one<{ likes: string[] }>(await db.from(table).select('likes').eq('id', id).limit(1))
        if (!row) return 0
        const likes = row.likes.includes(userId) ? row.likes.filter(u => u !== userId) : [...row.likes, userId]
        must(await db.from(table).update({ likes }).eq('id', id))
        return likes.length
      })
      return typeof n === 'number' ? n : 0
    },
    async toggleScrap(postId, userId) {
      const on = await rpcOr('toggle_post_scrap', { p_id: postId, p_user: userId }, async () => {
        const row = one<{ scraps: string[] }>(await db.from('posts').select('scraps').eq('id', postId).limit(1))
        if (!row) return false
        const next = !row.scraps.includes(userId)
        must(await db.from('posts').update({ scraps: next ? [...row.scraps, userId] : row.scraps.filter(u => u !== userId) }).eq('id', postId))
        return next
      })
      return on === true
    },

    // ponytail: 사진을 base64 텍스트로 DB에 둔다(브라우저에서 줄인 뒤라 장당 수백 KB 이하). 많아지면 Supabase Storage로 옮긴다
    async saveImage(data, type, ownerId) {
      const id = randomUUID()
      must(await db.from('images').insert({ id, type, ownerId, data: Buffer.from(data).toString('base64'), createdAt: now() }))
      return id
    },
    async getImage(id) {
      const row = one<{ type: ImageType; data: string }>(await db.from('images').select('type,data').eq('id', id).limit(1))
      return row ? { type: row.type, data: new Uint8Array(Buffer.from(row.data, 'base64')) } : null
    },

    async listComments(postId) { return rows<Comment>(await db.from('comments').select('*').eq('postId', postId).order('createdAt')) },
    async getComment(id) { return one<Comment>(await db.from('comments').select('*').eq('id', id).limit(1)) },
    async createComment(c) {
      const row: Comment = {
        id: randomUUID(), postId: c.postId, parentId: c.parentId, authorId: c.authorId, anonymous: c.anonymous, body: c.body, lang: c.lang,
        tr: {}, likes: [], createdAt: now(),
      }
      must(await db.from('comments').insert(row))
      return row
    },

    async listCourses(userId) {
      const t = await primaryOf(userId)
      return t ? rows<Course>(await db.from('courses').select('*').eq('tableId', t.id)).map(tidy) : []
    },
    async replaceCourses(userId, courses) {
      const t = await primaryOf(userId)
      if (t) await replaceIn(t, courses)
    },
    async listTables(userId, sem) { return tablesOf(userId, sem) },
    async getTable(id) { return tableById(id) },
    async createTable(userId, sem, name) {
      await tablesOf(userId, sem)
      const row: Table = { id: randomUUID(), userId, sem, name, primary: false, colors: {}, createdAt: now() }
      must(await db.from('tables').insert(row))
      return row
    },
    async updateTable(id, patch) {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      if (Object.keys(clean).length) must(await db.from('tables').update(clean).eq('id', id))
    },
    async setPrimary(id) {
      const t = await tableById(id)
      if (!t) return
      must(await db.from('tables').update({ primary: false }).eq('userId', t.userId).eq('sem', t.sem).neq('id', id))
      must(await db.from('tables').update({ primary: true }).eq('id', id))
    },
    async deleteTable(id) {
      const t = await tableById(id)
      if (!t) return
      const siblings = await tablesOf(t.userId, t.sem)
      if (siblings.length <= 1) return
      must(await db.from('courses').delete().eq('tableId', id))
      must(await db.from('tables').delete().eq('id', id))
      const heir = siblings.find(x => x.id !== id)
      if (t.primary && heir) must(await db.from('tables').update({ primary: true }).eq('id', heir.id))
    },
    async listTableCourses(tableId) { return rows<Course>(await db.from('courses').select('*').eq('tableId', tableId)).map(tidy) },
    async replaceTableCourses(tableId, courses) {
      const t = await tableById(tableId)
      if (t) await replaceIn(t, courses)
    },

    async listCatalog() { return rows<CatalogCourse>(await db.from('catalog').select('*')) },
    async addCatalog(list) {
      const uniq = [...new Map(list.map(c => [c.code, c])).values()]
      if (uniq.length) must(await db.from('catalog').upsert(uniq, { onConflict: 'code', ignoreDuplicates: true }))
    },
    async getGrades(userId) { return one<{ sems: GradeSemester[] }>(await db.from('grades').select('sems').eq('userId', userId).limit(1))?.sems ?? [] },
    async setGrades(userId, sems) { must(await db.from('grades').upsert({ userId, sems }, { onConflict: 'userId' })) },

    async listFriends(userId) {
      if (!safeId(userId)) return []
      const pairs = rows<{ a: string; b: string }>(await db.from('friends').select('a,b').or(`a.eq.${userId},b.eq.${userId}`))
      return profilesIn(pairs.map(p => (p.a === userId ? p.b : p.a)))
    },
    async addFriend(a, b) { await addFriend(a, b) },
    async requestFriend(from, to) {
      if (from === to || (await areFriends(from, to))) return 'already'
      if (await hasRequest(to, from)) {
        await respondFriend(from, to, true)
        return 'accepted'
      }
      must(await db.from('friend_requests').upsert({ from, to, createdAt: now() }, { onConflict: 'from,to', ignoreDuplicates: true }))
      return 'sent'
    },
    async listRequests(userId) {
      if (!safeId(userId)) return { incoming: [], outgoing: [] }
      const list = rows<{ from: string; to: string }>(await db.from('friend_requests').select('from,to').or(`from.eq.${userId},to.eq.${userId}`).order('createdAt'))
      return {
        incoming: await profilesIn(list.filter(r => r.to === userId).map(r => r.from)),
        outgoing: list.filter(r => r.from === userId).map(r => r.to),
      }
    },
    async respondFriend(me, from, accept) { await respondFriend(me, from, accept) },

    async listMessages(a, b) {
      if (!safeId(a) || !safeId(b)) return []
      const recent = rows<Message>(await db.from('messages').select('*')
        .or(`and(fromId.eq.${a},toId.eq.${b}),and(fromId.eq.${b},toId.eq.${a})`)
        .order('createdAt', { ascending: false }).limit(MESSAGE_LIMIT))
      return recent.reverse()
    },
    async getMessage(id) { return one<Message>(await db.from('messages').select('*').eq('id', id).limit(1)) },
    async listThreads(userId) {
      if (!safeId(userId)) return []
      // 최근 쪽지부터 읽어 상대별 첫 쪽지(=마지막 쪽지)만 남긴다
      const recent = rows<Message>(await db.from('messages').select('*').or(`fromId.eq.${userId},toId.eq.${userId}`).order('createdAt', { ascending: false }).limit(MESSAGE_LIMIT))
      const lastBy = new Map<string, Message>()
      for (const m of recent) {
        const other = m.fromId === userId ? m.toId : m.fromId
        if (!lastBy.has(other)) lastBy.set(other, m)
      }
      const byId = new Map((await profilesIn([...lastBy.keys()])).map(p => [p.id, p]))
      return [...lastBy].flatMap(([id, last]) => {
        const other = byId.get(id)
        return other ? [{ other, last }] : []
      })
    },
    async createMessage(m) {
      const row: Message = { id: randomUUID(), fromId: m.fromId, toId: m.toId, body: m.body, lang: m.lang, tr: {}, createdAt: now() }
      must(await db.from('messages').insert(row))
      return row
    },

    async listReviews(courseName) {
      let q = db.from('reviews').select('*')
      if (courseName) q = q.eq('courseName', courseName)
      return rows<Review>(await q.order('createdAt', { ascending: false }))
    },
    async getReview(id) { return one<Review>(await db.from('reviews').select('*').eq('id', id).limit(1)) },
    async createReview(r) {
      const row: Review = {
        id: randomUUID(), courseName: r.courseName, professor: r.professor, authorId: r.authorId, rating: r.rating,
        fields: r.fields, body: r.body, lang: r.lang, tr: {}, createdAt: now(),
      }
      must(await db.from('reviews').insert(row))
      return row
    },

    async listBoards() { return rows<Board>(await db.from('boards').select('*').order('createdAt')) },
    async createBoard(b) {
      const row: Board = { id: randomUUID(), name: b.name, desc: b.desc, lang: b.lang, ownerId: b.ownerId, tr: {}, createdAt: now() }
      must(await db.from('boards').insert(row))
      return row
    },
  }
}

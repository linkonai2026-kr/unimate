// 글 목록을 화면용 형태로 바꾸는 서버 도우미(작성자·댓글 수·게시판 이름 붙이기)
import 'server-only'
import { getStore } from '../store'
import type { Post, Profile } from '../types'
import { toPostView } from './flow'
import { loadBoards } from './list'

export async function postViews(posts: Post[], me: Profile) {
  const store = getStore()
  // 같은 작성자의 프로필은 한 번만 읽는다
  const profiles = new Map<string, Promise<Profile | null>>()
  const profileOf = (id: string) => {
    let p = profiles.get(id)
    if (!p) profiles.set(id, (p = store.getProfile(id)))
    return p
  }
  const [boards, rows] = await Promise.all([
    loadBoards(store, me.lang),
    Promise.all(posts.map(async p => {
      const [author, comments] = await Promise.all([profileOf(p.authorId), store.listComments(p.id)])
      return { p, author, comments: comments.length }
    })),
  ])
  const names = new Map(boards.map(b => [b.id, b.name]))
  return rows.map(({ p, author, comments }) => ({
    ...toPostView(p, { viewer: me.lang, viewerId: me.id, author, comments }),
    boardLabel: names.get(p.board) ?? p.board,
  }))
}

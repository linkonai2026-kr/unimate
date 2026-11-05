// Supabase 데모 DB를 시드 상태로 되돌린다: 시드에 없는 행(테스트 계정·e2e가 만든 글·친구·쪽지 등)만 지우고, 시드를 다시 넣는다
// 미리보기: npx tsx --env-file=.env.local scripts/reset-supabase-demo.mts        (지울 개수만 출력)
// 실제 실행: npx tsx --env-file=.env.local scripts/reset-supabase-demo.mts --yes  (지운 뒤 seed-supabase 다시 실행)
import { createClient } from '@supabase/supabase-js'
import { seedData } from '../src/lib/store/seed'

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 없어 건너뜀'); process.exit(0) }
const db = createClient(url, key, { auth: { persistSession: false } })
const yes = process.argv.includes('--yes')
const d = seedData()

const pair = (a: string, b: string) => [a, b].sort().join('|')
const keep = {
  profiles: new Set(d.profiles.map(r => r.id)), posts: new Set(d.posts.map(r => r.id)), comments: new Set(d.comments.map(r => r.id)),
  tables: new Set(d.tables.map(r => r.id)), courses: new Set(d.courses.map(r => r.id)), messages: new Set(d.messages.map(r => r.id)),
  reviews: new Set(d.reviews.map(r => r.id)), catalog: new Set(d.catalog.map(r => r.code)), grades: new Set(Object.keys(d.grades)),
  friends: new Set(d.friends.map(([a, b]) => pair(a, b))), requests: new Set(d.requests.map(([f, t]) => `${f}>${t}`)),
}

async function all<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if (!data || data.length < 1000) return out
  }
}
async function drop(table: string, col: string, values: string[]) {
  console.log(`${table}: 지울 ${values.length}개`)
  if (!yes) return
  for (let i = 0; i < values.length; i += 200) {
    const { error } = await db.from(table).delete().in(col, values.slice(i, i + 200))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

// id 열로 구분하는 표: 시드 id가 아니면 지운다(사용자 게시판·사진은 시드에 없으니 전부)
for (const [table, set] of [['profiles', keep.profiles], ['posts', keep.posts], ['comments', keep.comments], ['tables', keep.tables],
  ['courses', keep.courses], ['messages', keep.messages], ['reviews', keep.reviews], ['boards', new Set<string>()], ['images', new Set<string>()]] as const) {
  const rows = await all<{ id: string }>(table, 'id')
  await drop(table, 'id', rows.map(r => r.id).filter(id => !set.has(id)))
}
await drop('catalog', 'code', (await all<{ code: string }>('catalog', 'code')).map(r => r.code).filter(c => !keep.catalog.has(c)))
await drop('grades', 'userId', (await all<{ userId: string }>('grades', '"userId"')).map(r => r.userId).filter(u => !keep.grades.has(u)))

// 짝 키 표는 한 행씩 지운다
const friends = (await all<{ a: string; b: string }>('friends', 'a,b')).filter(r => !keep.friends.has(pair(r.a, r.b)))
console.log(`friends: 지울 ${friends.length}개`)
if (yes) for (const r of friends) { const { error } = await db.from('friends').delete().eq('a', r.a).eq('b', r.b); if (error) throw new Error(error.message) }
const reqs = (await all<{ from: string; to: string }>('friend_requests', '"from","to"')).filter(r => !keep.requests.has(`${r.from}>${r.to}`))
console.log(`friend_requests: 지울 ${reqs.length}개`)
if (yes) for (const r of reqs) { const { error } = await db.from('friend_requests').delete().eq('from', r.from).eq('to', r.to); if (error) throw new Error(error.message) }

// 신고·제재(스키마 끝 블록을 실행한 DB만): 신고는 모두 지우고, 남은 시드 글·댓글·가입자의 가림·경고·이용 제한을 푼다
const reports = await db.from('reports').select('id')
if (reports.error) console.log(`reports: 건너뜀(${reports.error.message})`)
else {
  await drop('reports', 'id', (reports.data as { id: string }[]).map(r => r.id))
  if (yes) {
    for (const [table, patch] of [['posts', { hidden: false }], ['comments', { hidden: false }], ['profiles', { violations: 0, suspendedUntil: null, sanctionReason: null }]] as const) {
      const { error } = await db.from(table).update(patch).in('id', [...keep[table]])
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }
}

console.log(yes ? '정리 완료 → 시드를 다시 넣으세요(npm run seed:supabase)' : '미리보기만 했습니다. 지우려면 --yes')

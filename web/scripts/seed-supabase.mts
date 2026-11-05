// Supabase에 데모 시드(가입자·글·댓글·시간표·강좌·강의평가·쪽지)를 넣는다. 여러 번 돌려도 같은 결과(upsert)
// 실행: npx tsx --env-file=.env.local scripts/seed-supabase.mts
import { createClient } from '@supabase/supabase-js'
import { seedData } from '../src/lib/store/seed'

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.log('SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 없어 건너뜀')
  process.exit(0)
}
const db = createClient(url, key, { auth: { persistSession: false } })
const d = seedData()

async function put(table: string, rows: object[], onConflict = 'id') {
  if (!rows.length) return
  const { error } = await db.from(table).upsert(rows, { onConflict })
  if (error) throw new Error(`${table}: ${error.message}`)
  console.log(`${table}: ${rows.length}`)
}

await put('profiles', d.profiles)
await put('posts', d.posts)
await put('comments', d.comments)
await put('tables', d.tables)
await put('courses', d.courses)
await put('catalog', d.catalog, 'code')
await put('friends', d.friends.map(([a, b]) => { const [x, y] = [a, b].sort(); return { a: x, b: y } }), 'a,b')
await put('friend_requests', d.requests.map(([from, to], i) => ({ from, to, createdAt: Date.now() + i })), 'from,to')
await put('messages', d.messages)
await put('reviews', d.reviews)
await put('grades', Object.entries(d.grades).map(([userId, sems]) => ({ userId, sems })), 'userId')
console.log('시드 완료')

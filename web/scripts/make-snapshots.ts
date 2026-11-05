// 저장한 강원대 HTML(tests/fixtures)로 공지 스냅샷 JSON을 다시 만든다(식단은 저장본 없이 늘 학교 사이트에서 새로 받는다)
// 실행: npx tsx scripts/make-snapshots.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { parseNoticeList } from '../src/lib/school/notices'

const fx = (n: string) => readFileSync(new URL(`../tests/fixtures/${n}.html`, import.meta.url), 'utf8')
const out = (n: string, v: unknown) => writeFileSync(new URL(`../src/lib/school/snapshot/${n}.json`, import.meta.url), JSON.stringify(v, null, 2) + '\n')

out('notices', [...parseNoticeList(fx('notice-academic-list'), 'academic').slice(0, 10), ...parseNoticeList(fx('notice-general-list'), 'general').slice(0, 10)])

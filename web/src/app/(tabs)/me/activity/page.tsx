// 내 활동: 내가 쓴 글·댓글 단 글·스크랩
import { NotePencil } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import PostCard from '@/components/PostCard'
import { Empty } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { postViews } from '@/lib/board/views'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'
import type { PostQuery } from '@/lib/store/types'

const TABS = { posts: 'myPosts', comments: 'myComments', scraps: 'myScraps' } as const
type Tab = keyof typeof TABS

// "toString"처럼 객체 원형에 있는 이름은 탭이 아니다
const isTab = (v: unknown): v is Tab => typeof v === 'string' && Object.hasOwn(TABS, v)

export default async function ActivityPage({ searchParams }: PageProps<'/me/activity'>) {
  const me = await requireUser()
  const lang = me.lang
  const raw = (await searchParams).tab
  const tab: Tab = isTab(raw) ? raw : 'posts'
  const query: Record<Tab, PostQuery> = { posts: { authorId: me.id }, comments: { commentedBy: me.id }, scraps: { scrapBy: me.id } }
  const views = await postViews(await getStore().listPosts(query[tab]), me)
  return (
    <div className="space-y-3 pb-6 pt-1">
      <nav className="rise mx-3 grid grid-cols-3 gap-1 rounded-2xl bg-line/60 p-1" aria-label={t(lang, 'me')}>
        {(Object.keys(TABS) as Tab[]).map(k => (
          <Link key={k} href={`/me/activity?tab=${k}`} replace aria-current={tab === k ? 'page' : undefined}
            className={`press flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-[14px] font-semibold leading-tight ${tab === k ? 'bg-bg text-ink shadow-sm' : 'text-muted'}`}>{t(lang, TABS[k])}</Link>
        ))}
      </nav>
      <div className="rise card mx-3 divide-y divide-line/70 overflow-hidden">
        {views.length === 0 ? <Empty icon={<NotePencil size={28} aria-hidden />} title={t(lang, 'noData')} /> : views.map(p => <PostCard key={p.id} p={p} lang={lang} showBoard />)}
      </div>
    </div>
  )
}

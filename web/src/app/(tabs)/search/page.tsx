// 글 검색(원문과 번역문 모두에서 찾음)
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import PostCard from '@/components/PostCard'
import { Empty, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { cleanInput } from '@/lib/board/flow'
import { postViews } from '@/lib/board/views'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'

/** 검색어 길이·결과 수 상한 */
const MAX_QUERY = 50, MAX_RESULTS = 50

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const me = await requireUser()
  const lang = me.lang
  // ?q=가 여러 개 와도 첫 값만, 한 줄로 정리
  const raw = (await searchParams).q
  const q = cleanInput(Array.isArray(raw) ? raw[0] : raw, MAX_QUERY)
  const views = q ? await postViews(await getStore().listPosts({ query: q, limit: MAX_RESULTS }), me) : []
  return (
    <div className="space-y-3 pb-6 pt-1">
      <form role="search" className="px-3">
        <label className="relative block">
          <span className="sr-only">{t(lang, 'search')}</span>
          <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" name="q" defaultValue={q} maxLength={MAX_QUERY} enterKeyHint="search" autoComplete="off" autoFocus placeholder={t(lang, 'searchPlaceholder')} className={`${field} bg-bg pl-11`} />
        </label>
      </form>
      {q && (
        <div className="rise card mx-3 divide-y divide-line/70 overflow-hidden">
          {views.length === 0 ? <Empty icon={<MagnifyingGlass size={28} />} title={t(lang, 'noData')} /> : views.map(p => <PostCard key={p.id} p={p} lang={lang} showBoard />)}
        </div>
      )}
    </div>
  )
}

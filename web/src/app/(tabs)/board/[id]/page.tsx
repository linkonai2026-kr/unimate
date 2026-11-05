// 게시판 글 목록(HOT·BEST 가상 게시판 포함), 아래 가운데 떠 있는 글쓰기 버튼. 학생이 만든 게시판은 만든 사람에게 ··· 메뉴(게시판 삭제)
import { NotePencil, PencilSimple, Trash } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { removeBoard } from '@/app/board-actions'
import LiveRefresh from '@/components/LiveRefresh'
import { ConfirmButton, MoreMenu } from '@/components/MoreMenu'
import PostCard from '@/components/PostCard'
import { Empty, menuItem } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { VIRTUAL, isVirtual } from '@/lib/boards'
import { loadBoards } from '@/lib/board/list'
import { postViews } from '@/lib/board/views'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'

export default async function BoardPage({ params }: PageProps<'/board/[id]'>) {
  const { id } = await params
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const real = (await loadBoards(store, lang)).find(b => b.id === id)
  const virtual = !real && isVirtual(id) ? VIRTUAL[id] : null
  const head = real ?? (virtual && { name: virtual.name[lang], desc: virtual.desc[lang] })
  if (!head) notFound()
  const posts = await store.listPosts(real ? { board: real.id } : id === 'hot' ? { hot: true } : { best: true })
  const views = await postViews(posts, me)
  return (
    <div className="pb-20">
      <LiveRefresh topics={[real ? `board:${real.id}` : 'board:all']} />
      {/* relative z-20: ··· 메뉴가 아래 글 목록 카드 밑으로 숨지 않게 */}
      <div className="rise relative z-20 flex items-start gap-2 px-5 pb-4 pt-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[24px] font-bold tracking-tight">{head.name}</h2>
          {head.desc && <p className="mt-1 text-[14px] text-muted">{head.desc}</p>}
        </div>
        {real?.custom && real.ownerId === me.id && (
          <MoreMenu label={t(lang, 'boardMenu')}>
            <form action={removeBoard.bind(null, real.id)}>
              <ConfirmButton message={t(lang, 'deleteBoardHint')} className={`${menuItem} text-danger`}><Trash size={18} aria-hidden />{t(lang, 'deleteBoard')}</ConfirmButton>
            </form>
          </MoreMenu>
        )}
      </div>
      <div className="rise card mx-3 divide-y divide-line/70 overflow-hidden">
        {views.length === 0
          ? <Empty icon={<NotePencil size={28} />} title={t(lang, 'noData')} />
          : views.map(p => <PostCard key={p.id} p={p} lang={lang} showBoard={!real} />)}
      </div>
      {real && (
        <Link href={`/write/${encodeURIComponent(real.id)}`} className="press fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-10 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-navy px-6 text-[15px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(1,29,72,.45)]">
          <PencilSimple size={18} weight="bold" aria-hidden />{t(lang, 'write')}
        </Link>
      )}
    </div>
  )
}

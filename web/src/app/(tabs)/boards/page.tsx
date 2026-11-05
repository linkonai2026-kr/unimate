// 게시판 탭: 내 활동(쓴 글·댓글·스크랩), HOT·BEST, 전체 게시판(핀으로 홈 고정), 학생들이 만든 게시판, 게시판 만들기
import { BookmarkSimple, ChatCircleText, Fire, NotePencil, Plus, PushPin, Trophy, UsersThree } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { togglePinBoard } from '@/app/board-actions'
import { IconBox, Row, Section, btn } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { VIRTUAL } from '@/lib/boards'
import { loadBoards, pinsOf, type BoardView } from '@/lib/board/list'
import { t, type Lang } from '@/lib/i18n'
import { getStore } from '@/lib/store'

const ACTIVITY = [
  ['/me/activity?tab=posts', 'myPosts', NotePencil, 'navy'],
  ['/me/activity?tab=comments', 'myComments', ChatCircleText, 'teal'],
  ['/me/activity?tab=scraps', 'myScraps', BookmarkSimple, 'star'],
] as const

function BoardRow({ b, pinned, lang }: { b: BoardView; pinned: boolean; lang: Lang }) {
  return (
    <li className="flex items-center pr-3">
      <div className="min-w-0 flex-1"><Row href={`/board/${encodeURIComponent(b.id)}`} icon={<IconBox tone={b.custom ? 'teal' : 'gray'}>{b.custom ? <UsersThree size={20} weight="fill" /> : <NotePencil size={20} weight="fill" />}</IconBox>} title={b.name} sub={b.desc} chevron={false} /></div>
      {/* 원하는 상태(!pinned)를 함께 보내 두 번 눌려도 결과가 같다 */}
      <form action={togglePinBoard.bind(null, b.id, !pinned)}>
        <button aria-label={t(lang, pinned ? 'unpinBoard' : 'pinBoard')} aria-pressed={pinned} className={`press flex h-11 w-11 items-center justify-center rounded-xl ${pinned ? 'bg-mint-soft text-mint-text' : 'text-[#c4c9d2]'}`}>
          <PushPin size={20} weight={pinned ? 'fill' : 'regular'} aria-hidden />
        </button>
      </form>
    </li>
  )
}

export default async function BoardsPage() {
  const me = await requireUser()
  const lang = me.lang
  const boards = await loadBoards(getStore(), lang)
  const pins = new Set(pinsOf(me))
  const custom = boards.filter(b => b.custom)
  return (
    <div className="space-y-3 pb-6 pt-1">
      <Section>
        <div className="grid grid-cols-3 gap-1 px-2 py-4">
          {ACTIVITY.map(([href, key, Icon, tone]) => (
            <Link key={href} href={href} className="press flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-1">
              <IconBox tone={tone} size={48}><Icon size={24} weight="fill" /></IconBox>
              <span className="text-center text-[13px] font-medium leading-tight">{t(lang, key)}</span>
            </Link>
          ))}
        </div>
      </Section>
      <Section>
        <ul className="py-2">
          <li><Row href="/board/hot" icon={<IconBox tone="danger"><Fire size={22} weight="fill" /></IconBox>} title={VIRTUAL.hot.name[lang]} sub={VIRTUAL.hot.desc[lang]} /></li>
          <li><Row href="/board/best" icon={<IconBox tone="star"><Trophy size={22} weight="fill" /></IconBox>} title={VIRTUAL.best.name[lang]} sub={VIRTUAL.best.desc[lang]} /></li>
        </ul>
      </Section>
      <Section title={t(lang, 'allBoards')}>
        <ul className="pb-2">{boards.filter(b => !b.custom).map(b => <BoardRow key={b.id} b={b} pinned={pins.has(b.id)} lang={lang} />)}</ul>
      </Section>
      <Section title={t(lang, 'madeByUsers')}>
        {custom.length > 0 && <ul>{custom.map(b => <BoardRow key={b.id} b={b} pinned={pins.has(b.id)} lang={lang} />)}</ul>}
        <div className="px-5 pb-5 pt-2"><Link href="/boards/new" className={btn.soft}><Plus size={18} weight="bold" aria-hidden />{t(lang, 'createBoard')}</Link></div>
      </Section>
    </div>
  )
}

// 글쓰기 시작: 게시판 탭의 글쓰기 버튼에서 온다. 쓸 게시판을 고르면 그 게시판 글쓰기 화면으로
import { NotePencil, UsersThree } from '@phosphor-icons/react/dist/ssr'
import { IconBox, Row, Section } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { loadBoards } from '@/lib/board/list'
import { t } from '@/lib/i18n'
import { getStore } from '@/lib/store'

export default async function PickBoardPage() {
  const me = await requireUser()
  const lang = me.lang
  const boards = await loadBoards(getStore(), lang)
  return (
    <div className="space-y-3 pb-6 pt-1">
      <Section title={t(lang, 'pickBoard')}>
        <ul className="pb-2">
          {boards.map(b => (
            <li key={b.id}>
              <Row href={`/write/${encodeURIComponent(b.id)}`} title={b.name} sub={b.desc}
                icon={<IconBox tone={b.custom ? 'teal' : 'gray'}>{b.custom ? <UsersThree size={20} weight="fill" /> : <NotePencil size={20} weight="fill" />}</IconBox>} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

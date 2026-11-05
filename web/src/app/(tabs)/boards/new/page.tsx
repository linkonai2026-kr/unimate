// 게시판 만들기: 이름·한 줄 설명(어떤 언어로 써도 번역됨), 아래 큰 만들기 버튼
import { createBoard } from '@/app/board-actions'
import { BottomCTA, btn, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'

export default async function NewBoardPage() {
  const { lang } = await requireUser()
  const label = 'block space-y-2 text-[14px] font-semibold text-muted'
  return (
    <form action={createBoard} className="pb-40 pt-1">
      <div className="rise card mx-3 space-y-4 p-5">
        <label className={label}>{t(lang, 'boardNameLabel')}<input name="name" required maxLength={20} autoComplete="off" className={field} /></label>
        <label className={label}>{t(lang, 'boardDescLabel')}<input name="desc" maxLength={60} autoComplete="off" className={field} /></label>
        <p className="text-[13px] text-muted">{t(lang, 'createBoardHint')}</p>
      </div>
      <BottomCTA><button className={btn.primary}>{t(lang, 'createBoard')}</button></BottomCTA>
    </form>
  )
}

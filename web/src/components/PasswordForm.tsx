'use client'
// 현재 비밀번호 확인 후 새 비밀번호로 바꾸는 폼
import { CheckCircle } from '@phosphor-icons/react'
import { useActionState, useId } from 'react'
import { changePassword } from '@/app/auth-actions'
import { BottomCTA, btn, field } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'

export default function PasswordForm({ lang }: { lang: Lang }) {
  const [state, action, pending] = useActionState(changePassword, undefined)
  const id = useId()
  return (
    <form action={action} className="rise space-y-4 px-4 pb-40 pt-2">
      <label className="block space-y-2"><span className="text-[14px] font-semibold text-muted">{t(lang, 'currentPassword')}</span>
        <input name="current" type="password" required autoComplete="current-password" placeholder={t(lang, 'currentPassword')} enterKeyHint="next" className={`${field} bg-bg`} /></label>
      <label className="block space-y-2"><span className="text-[14px] font-semibold text-muted">{t(lang, 'newPassword')}</span>
        <input name="next" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder={t(lang, 'newPassword')}
          enterKeyHint="go" aria-describedby={`${id}-rule`} className={`${field} bg-bg`} /></label>
      <span id={`${id}-rule`} className="-mt-2 block text-[13px] text-[#8b93a1]">{t(lang, 'passwordRule')}</span>
      {state?.error && <p role="alert" className="text-[14px] font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="flex items-center gap-1.5 text-[15px] font-semibold text-teal"><CheckCircle size={20} weight="fill" aria-hidden />{t(lang, 'passwordChanged')}</p>}
      <BottomCTA><button disabled={pending} aria-busy={pending} className={btn.primary}>{t(lang, 'changePassword')}</button></BottomCTA>
    </form>
  )
}

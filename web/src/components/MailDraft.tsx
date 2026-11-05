'use client'
// 담당 부서 메일 초안: 이름·학과·학번을 확인하고 누르면 AI가 한국어 메일과 내 언어 번역을 쓴다.
// 메일 앱은 제목·본문이 채워진 채로 열리고(mailto), 학생은 확인 뒤 보내기만 누르면 된다
import { Check, Copy, EnvelopeSimple, PaperPlaneTilt, Sparkle } from '@phosphor-icons/react'
import { useActionState, useState } from 'react'
import { draftMail, type MailState } from '@/app/deadline-actions'
import { btn, field } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'

const label = 'block space-y-1.5 text-[13px] font-semibold text-muted'
const chip = 'press inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl px-4 text-[15px] font-bold'

export default function MailDraft({ taskId, lang, defaults, emails }: {
  taskId: string
  lang: Lang
  defaults: { name: string; major: string; studentId: string }
  /** 공지 본문에 적힌 메일 주소(학교 주소 먼저). 없으면 메일 앱에서 받는 사람을 넣는다 */
  emails: string[]
}) {
  const [state, action, pending] = useActionState<MailState, FormData>(draftMail.bind(null, taskId), undefined)
  const [copied, setCopied] = useState(false)
  const v = state?.values ?? { ...defaults, to: emails[0] ?? '' }
  const ok = state?.ok ? state : null

  async function copy() {
    if (!ok) return
    try {
      await navigator.clipboard.writeText(`${ok.draft.subject}\n\n${ok.draft.body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* 복사를 못 하면 화면의 글을 직접 고른다 */ }
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <label className={label}>{t(lang, 'mailName')}<input name="name" defaultValue={v.name} maxLength={30} autoComplete="name" className={field} /></label>
          <label className={label}>{t(lang, 'majorLabel')}<input name="major" defaultValue={v.major} maxLength={30} className={field} /></label>
          <label className={label}>{t(lang, 'mailStudentId')}<input name="studentId" defaultValue={v.studentId} maxLength={20} inputMode="numeric" className={field} /></label>
        </div>
        {emails.length > 0 ? (
          <label className={label}>{t(lang, 'mailTo')}
            <select name="to" defaultValue={v.to} className={field}>{emails.map(e => <option key={e} value={e}>{e}</option>)}</select>
          </label>
        ) : <p className="text-[13px] text-muted">{t(lang, 'mailNoTo')}</p>}
        <button disabled={pending} aria-busy={pending} data-track="mail_draft" className={btn.primary}>
          <Sparkle size={18} weight="fill" aria-hidden />{t(lang, ok ? 'mailRewrite' : 'mailWrite')}
        </button>
        {state && !state.ok && <p role="alert" className="text-[14px] font-medium text-danger">{t(lang, state.error === 'limit' ? 'mailLimit' : 'tryAgain')}</p>}
      </form>

      {ok && (
        <div aria-live="polite" className="space-y-3">
          <section className="rounded-2xl bg-bg-soft p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-teal"><EnvelopeSimple size={16} weight="fill" aria-hidden />{t(lang, 'mailKo')}</p>
            {ok.to && <p className="mt-2 text-[13px] text-muted">{t(lang, 'mailTo')} · {ok.to}</p>}
            <div lang="ko">
              <p className="mt-2 text-[15px] font-bold">{ok.draft.subject}</p>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{ok.draft.body}</p>
            </div>
          </section>
          {lang !== 'ko' && (
            <details open className="rounded-2xl bg-mint-soft p-4">
              <summary className="cursor-pointer text-[13px] font-bold text-mint-text">{t(lang, 'mailMine')}</summary>
              <div lang={lang}>
                <p className="mt-2 text-[15px] font-bold">{ok.draft.subjectTr}</p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{ok.draft.bodyTr}</p>
              </div>
            </details>
          )}
          <p className="text-[13px] font-medium text-danger">{t(lang, 'mailCheck')}</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <a href={ok.mailto} data-track="mail_open" className={`${chip} bg-teal text-white`}><PaperPlaneTilt size={18} weight="fill" aria-hidden />{t(lang, 'mailOpen')}</a>
            <button type="button" onClick={copy} data-track="mail_copy" className={`${chip} bg-bg-soft text-ink`}>
              {copied ? <Check size={18} weight="bold" aria-hidden /> : <Copy size={18} aria-hidden />}{t(lang, copied ? 'mailCopied' : 'mailCopy')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

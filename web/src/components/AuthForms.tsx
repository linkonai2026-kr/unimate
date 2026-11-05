'use client'
// 로그인·가입 폼(라벨은 입력칸 위, 안내·오류는 아래, 큰 버튼 하나). 실패해도 쓴 값(비밀번호 제외)은 남긴다
import { useActionState, useId, useState } from 'react'
import { login, signup } from '@/app/auth-actions'
import { btn, field } from '@/components/ui'
import { isLang, LANGS, t, type Lang } from '@/lib/i18n'
import { langForNation } from '@/lib/nations'

const label = 'block space-y-2 text-[14px] font-semibold text-muted'
const hint = 'block text-[13px] font-normal text-[#8b93a1]'
/** 아이디 칸: 휴대폰 키보드가 첫 글자를 대문자로 바꾸거나 고치지 않게 */
const handleInput = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const
const DEFAULT_NATION: Record<Lang, string> = { ko: 'KR', en: 'US', vi: 'VN', zh: 'CN', uz: 'UZ' }

export function LoginForm({ lang, demo, next }: { lang: Lang; demo: { handle: string; password: string; label: string; nation: string }[]; next?: string | null }) {
  const [state, action, pending] = useActionState(login, undefined)
  const errId = useId()
  const err = state?.error
  const described = err ? errId : undefined
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="uiLang" value={lang} />
        {next && <input type="hidden" name="next" value={next} />}
        <label className={label}>{t(lang, 'handle')}
          <input name="handle" autoComplete="username" placeholder={t(lang, 'handle')} className={field} required maxLength={40} defaultValue={state?.values?.handle}
            aria-invalid={!!err} aria-describedby={described} {...handleInput} />
        </label>
        <label className={label}>{t(lang, 'password')}
          <input name="password" type="password" autoComplete="current-password" placeholder={t(lang, 'password')} className={field} required
            aria-invalid={!!err} aria-describedby={described} />
        </label>
        {err && <p id={errId} role="alert" className="text-[14px] font-medium text-danger">{err}</p>}
        <button disabled={pending} aria-busy={pending} className={btn.primary}>{t(lang, 'login')}</button>
      </form>
      {demo.length > 0 && (
        <div className="rounded-[20px] bg-mint-soft p-4">
          <p className="mb-3 text-[14px] font-semibold text-mint-text">{t(lang, 'demoLogin')}</p>
          <div className="grid grid-cols-2 gap-2">
            {demo.map(d => (
              <form key={d.handle} action={action}>
                <input type="hidden" name="uiLang" value={lang} />
                {next && <input type="hidden" name="next" value={next} />}
                <input type="hidden" name="handle" value={d.handle} />
                <input type="hidden" name="password" value={d.password} />
                <button disabled={pending} className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-bg text-[15px] font-bold">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/flags/${d.nation}.svg`} alt="" className="h-3.5 w-auto rounded-[2px] ring-1 ring-black/5" />{d.label}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** next: 가입 뒤 돌아갈 주소(서버에서 safeNext로 거른 값). nations: [코드, 이 화면 언어의 국가 이름] — 서버에서 정해 넘겨 하이드레이션이 어긋나지 않게 */
export function SignupForm({ lang, nations, next }: { lang: Lang; nations: [string, string][]; next?: string | null }) {
  const [state, action, pending] = useActionState(signup, undefined)
  const id = useId()
  const v = state?.values
  // 언어 칸은 국적을 따라 바뀌므로 상태로 둔다(가입 실패 뒤에도 고른 값이 남는다)
  const [userLang, setUserLang] = useState<Lang>(isLang(v?.lang) ? v.lang : lang)
  const [nation, setNation] = useState<string>(v?.nationality ?? DEFAULT_NATION[lang])
  // 위의 화면 언어 버튼을 누르면(?lang= 이동, 입력한 값은 그대로) 국적·사용 언어도 그 언어에 맞춰 바로 바꾼다
  const [shownLang, setShownLang] = useState<Lang>(lang)
  if (shownLang !== lang) {
    setShownLang(lang)
    setUserLang(lang)
    setNation(DEFAULT_NATION[lang])
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="uiLang" value={lang} />
      {next && <input type="hidden" name="next" value={next} />}
      <label className={label}>{t(lang, 'handle')}
        <input name="handle" autoComplete="username" placeholder={t(lang, 'handle')} className={field} required minLength={3} maxLength={20}
          pattern="[A-Za-z0-9]{3,20}" aria-describedby={`${id}-handle`} defaultValue={v?.handle} {...handleInput} />
      </label>
      <span id={`${id}-handle`} className={`${hint} -mt-2`}>{t(lang, 'handleRule')}</span>
      <label className={label}>{t(lang, 'password')}
        <input name="password" type="password" autoComplete="new-password" placeholder={t(lang, 'password')} className={field} required minLength={8} maxLength={128}
          aria-describedby={`${id}-password`} />
      </label>
      <span id={`${id}-password`} className={`${hint} -mt-2`}>{t(lang, 'passwordRule')}</span>
      <label className={label}>{t(lang, 'nickname')}
        <input name="nickname" autoComplete="nickname" placeholder={t(lang, 'nickname')} className={field} required maxLength={20} defaultValue={v?.nickname} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>{t(lang, 'nationality')}
          {/* 국적을 고르면 그 나라 언어를 미리 골라 준다(언어는 그 뒤에 따로 바꿀 수 있다) */}
          <select name="nationality" className={field} value={nation} onChange={e => { setNation(e.target.value); setUserLang(langForNation(e.target.value)) }}>
            {nations.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label className={label}>{t(lang, 'language')}
          <select name="lang" className={field} value={userLang} onChange={e => setUserLang(isLang(e.target.value) ? e.target.value : lang)}>
            {LANGS.map(l => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
          </select>
        </label>
      </div>
      {state?.error && <p role="alert" className="text-[14px] font-medium text-danger">{state.error}</p>}
      <button disabled={pending} aria-busy={pending} className={btn.primary}>{t(lang, 'signup')}</button>
    </form>
  )
}

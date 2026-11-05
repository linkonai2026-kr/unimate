// 회원가입 화면(국적·모국어 선택). ?next=가 있으면 가입 뒤 그 화면으로
import Link from 'next/link'
import AuthShell, { authHref } from '@/components/AuthShell'
import { SignupForm } from '@/components/AuthForms'
import { guestLang } from '@/lib/auth/session'
import { safeNext } from '@/lib/auth/token'
import { t } from '@/lib/i18n'
import { NATIONS, nationLabel } from '@/lib/nations'

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const sp = await searchParams
  const lang = guestLang(sp.lang)
  const next = safeNext(sp.next)
  const nations = NATIONS.map((n): [string, string] => [n, nationLabel(n, lang)])
  return (
    <AuthShell lang={lang} path="/signup" next={next} footer={<Link href={authHref('/login', lang, next)} className="font-semibold text-teal">{t(lang, 'haveAccount')}</Link>}>
      <SignupForm lang={lang} nations={nations} next={next} />
    </AuthShell>
  )
}

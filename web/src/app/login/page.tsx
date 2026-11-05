// 로그인 화면(메모리 모드에서는 데모 계정 버튼 표시). ?next=가 있으면 로그인 뒤 그 화면으로
import Link from 'next/link'
import AuthShell, { authHref } from '@/components/AuthShell'
import { LoginForm } from '@/components/AuthForms'
import { guestLang } from '@/lib/auth/session'
import { safeNext } from '@/lib/auth/token'
import { has } from '@/lib/env'
import { t } from '@/lib/i18n'
import { DEMO_PASSWORD } from '@/lib/store/seed'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const lang = guestLang(sp.lang)
  const next = safeNext(sp.next)
  // 메모리 모드는 항상, 실서비스는 DEMO_LOGIN=1일 때만 데모 계정 버튼을 보인다(발표·e2e용)
  const showDemo = !has.db || process.env.DEMO_LOGIN === '1'
  const demo = showDemo ? [
    // 한국어·중국어·베트남어 체험용(국적·언어는 바꿀 수 없다)
    { handle: 'minjun', password: DEMO_PASSWORD, label: '민준', nation: 'kr' },
    { handle: 'wei', password: DEMO_PASSWORD, label: '王伟', nation: 'cn' },
    { handle: 'linh', password: DEMO_PASSWORD, label: 'Linh', nation: 'vn' },
  ] : []
  return (
    <AuthShell lang={lang} path="/login" next={next} footer={<Link href={authHref('/signup', lang, next)} className="font-semibold text-teal">{t(lang, 'noAccount')}</Link>}>
      <LoginForm lang={lang} demo={demo} next={next} />
      {/* 교직원·지역 주민·방문객은 로그인 없이 지도·학식·공지 */}
      <Link href={`/visit?lang=${lang}`} className="press mt-3 flex h-12 items-center justify-center rounded-2xl bg-bg-soft text-[15px] font-semibold text-ink">{t(lang, 'visitBrowse')}</Link>
    </AuthShell>
  )
}

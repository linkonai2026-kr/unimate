// 없는 주소·지워진 글(404): 사용자 언어로 안내하고 홈(로그인 전이면 방문객 화면)으로 돌아갈 길을 준다
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { btn } from '@/components/ui'
import { currentUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'

export default async function NotFound() {
  const me = await currentUser()
  const lang = me?.lang ?? 'ko'
  return (
    <main lang={lang} className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-3 bg-bg-soft px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-navy/8 text-navy" aria-hidden><MagnifyingGlass size={32} weight="bold" /></span>
      <h1 className="mt-2 text-[20px] font-bold tracking-tight">{t(lang, 'notFound')}</h1>
      <p className="text-[15px] text-muted">{t(lang, 'pageNotFound')}</p>
      <Link href={me ? '/' : `/visit?lang=${lang}`} className={`${btn.primary} mt-4 max-w-[280px]`}>{t(lang, 'tab.home')}</Link>
    </main>
  )
}

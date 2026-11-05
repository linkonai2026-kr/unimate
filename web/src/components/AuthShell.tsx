// 로그인·가입 화면 공통 틀: 로고, 큰 안내 문장, 언어 고르기(로그인 전부터 모국어로)
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { LANGS, t, type Lang } from '@/lib/i18n'

/** 로그인·가입 화면 주소(언어와 돌아갈 주소를 유지) */
export const authHref = (path: string, lang: Lang, next?: string | null) =>
  `${path}?lang=${lang}${next ? `&next=${encodeURIComponent(next)}` : ''}`

export default function AuthShell({ lang, path, next, children, footer }: { lang: Lang; path: string; next?: string | null; children: ReactNode; footer: ReactNode }) {
  return (
    // 화면 언어를 lang으로 알려 화면 읽기 프로그램이 맞는 발음으로 읽게
    <div lang={lang} className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg px-6 pb-10 pt-14">
      <h1><Image src="/brand/logo.png" alt="Unimate" width={132} height={32} priority /></h1>
      <p className="rise mt-6 text-[26px] font-bold leading-snug tracking-tight">{t(lang, 'welcome')}</p>
      <nav className="rise mt-5 flex flex-wrap gap-1.5" aria-label={t(lang, 'language')}>
        {LANGS.map(l => (
          <Link key={l.code} href={authHref(path, l.code, next)} hrefLang={l.code} lang={l.code} replace
            aria-current={l.code === lang ? 'true' : undefined}
            className={`press inline-flex min-h-11 items-center rounded-full px-3.5 text-[14px] font-semibold ${l.code === lang ? 'bg-navy text-white' : 'bg-bg-soft text-ink'}`}>
            {l.label}
          </Link>
        ))}
      </nav>
      <main className="rise mt-8 flex-1">{children}</main>
      <div className="mt-6 text-center text-[15px]">{footer}</div>
      <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">{t(lang, 'statsNotice')}</p>
    </div>
  )
}

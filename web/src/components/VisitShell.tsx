// 방문객 모드 틀: 상단(로고·방문객 표시·언어·로그인)과 하단 4개 탭(홈·지도·학식·공지). 언어는 주소의 ?lang=으로 유지
import { ForkKnife, House, MapPin, Megaphone, Translate } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import type { ReactNode } from 'react'
import Tracker from '@/components/Tracker'
import { LANGS, t, type Lang, type UiKey } from '@/lib/i18n'
import { visitHref } from '@/lib/visit'

export type VisitTab = 'home' | 'map' | 'menu' | 'notices'

const TABS: { id: VisitTab; path: string; key: UiKey; Icon: typeof House }[] = [
  { id: 'home', path: '/visit', key: 'tab.home', Icon: House },
  { id: 'map', path: '/visit/map', key: 'tab.map', Icon: MapPin },
  { id: 'menu', path: '/visit/menu', key: 'weekMenu', Icon: ForkKnife },
  { id: 'notices', path: '/visit/notices', key: 'notices', Icon: Megaphone },
]

export default function VisitShell({ lang, active, query = {}, children }: { lang: Lang; active: VisitTab; query?: Record<string, string>; children: ReactNode }) {
  const here = (TABS.find(x => x.id === active) ?? TABS[0]).path
  return (
    <div lang={lang} className="mx-auto min-h-dvh max-w-[480px] bg-bg-soft pb-[calc(8rem+env(safe-area-inset-bottom))]">
      {/* 높이 56px: 지도 화면이 상단 56px·하단 64px를 빼고 높이를 잡는다 */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 bg-bg/95 px-2 backdrop-blur min-[400px]:gap-2 min-[400px]:px-3">
        {/* 좁은 화면(360px 안팎)에서도 한 줄에 들어가도록 로고를 줄이고 눌려 찌그러지지 않게 한다 */}
        <Link href={visitHref('/visit', lang)} className="press shrink-0" aria-label="Unimate"><Image src="/brand/logo.png" alt="Unimate" width={96} height={23} priority className="h-auto w-[68px] min-[400px]:w-24" /></Link>
        {/* 베트남어("Chế độ khách"·"Tiếng Việt"·"Đăng nhập")는 460px 아래에서 한 줄에 안 들어가서, 좁은 화면에선 방문객 표시를 숨긴다(하단 탭 이름으로도 알 수 있다) */}
        {/* 방문객 표시는 늘 보인다. 대신 400px 아래에서는 언어 버튼을 아이콘만으로 줄여 vi·uz도 360px 한 줄에 들어간다 */}
        <span className="shrink-0 whitespace-nowrap rounded-md bg-teal/10 px-1.5 py-0.5 text-[11px] font-bold text-teal">{t(lang, 'visitor')}</span>
        {/* 언어를 바꾸면 화면이 같은 틀로 다시 그려지므로, key로 메뉴를 새로 만들어 닫힌 채로 시작한다 */}
        <details key={lang} data-lang-menu className="relative ml-auto">
          <summary aria-label={t(lang, 'language')} className="press flex h-11 cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-[14px] font-semibold"><Translate size={22} aria-hidden /><span className="hidden min-[400px]:inline">{LANGS.find(l => l.code === lang)?.label}</span></summary>
          <nav aria-label={t(lang, 'language')} className="absolute right-0 top-11 z-40 w-40 overflow-hidden rounded-2xl bg-bg shadow-[0_8px_24px_-8px_rgba(1,29,72,.35)]">
            {LANGS.map(l => (
              <Link key={l.code} href={visitHref(here, l.code, query)} lang={l.code} hrefLang={l.code} aria-current={l.code === lang ? 'true' : undefined}
                className={`block px-4 py-3 text-[15px] ${l.code === lang ? 'bg-bg-soft font-bold text-navy' : ''}`}>{l.label}</Link>
            ))}
          </nav>
        </details>
        <Link href={`/login?lang=${lang}`} className="press flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-navy px-3 text-[14px] font-bold text-white min-[400px]:px-3.5">{t(lang, 'login')}</Link>
      </header>
      {/* 언어 메뉴(details)는 바깥을 눌러도 안 닫혀서, 문서에 한 번만 다는 손잡이로 닫는다(id가 같아 화면을 옮겨도 한 번만 실행) */}
      <Script id="visit-lang-menu-close">{`document.addEventListener('pointerdown',function(e){document.querySelectorAll('details[data-lang-menu][open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open')})})`}</Script>
      <main>{children}</main>
      <Tracker visitor lang={lang} />
      <nav aria-label={t(lang, 'visitor')} className="fixed inset-x-0 bottom-0 z-20 bg-bg/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line)] backdrop-blur">
        <ul className="mx-auto flex max-w-[480px]">
          {TABS.map(({ id, path, key, Icon }) => {
            const on = id === active
            return (
              <li key={id} className="flex-1">
                <Link href={visitHref(path, lang)} aria-current={on ? 'page' : undefined} className={`press flex h-16 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] leading-tight ${on ? 'font-bold text-navy' : 'font-medium text-[#a4abb8]'}`}>
                  <Icon size={26} weight={on ? 'fill' : 'regular'} aria-hidden />
                  {t(lang, key)}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

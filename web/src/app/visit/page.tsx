// 방문객 모드 첫 화면: 로그인 없이 교직원·지역 주민·방문객이 언어를 고르고 길찾기·학식·공지로 바로 간다
import { CaretRight, ForkKnife, MapPin, Megaphone } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import VisitShell from '@/components/VisitShell'
import { guestLang } from '@/lib/auth/session'
import { LANGS, t } from '@/lib/i18n'
import { buildingById, buildingName } from '@/lib/map/buildings'
import { POPULAR, visitHref } from '@/lib/visit'

export default async function VisitHome({ searchParams }: PageProps<'/visit'>) {
  const lang = guestLang((await searchParams).lang)
  const cards = [
    { href: visitHref('/visit/map', lang), label: t(lang, 'visitMap'), Icon: MapPin },
    { href: visitHref('/visit/menu', lang), label: t(lang, 'weekMenu'), Icon: ForkKnife },
    { href: visitHref('/visit/notices', lang), label: t(lang, 'notices'), Icon: Megaphone },
  ]
  const popular = POPULAR.map(id => buildingById(id)).filter(b => b !== undefined)
  return (
    <VisitShell lang={lang} active="home">
      <section className="rise px-5 pb-2 pt-4">
        <h1 className="text-[24px] font-bold leading-snug tracking-tight">{t(lang, 'visitTitle')}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{t(lang, 'visitIntro')}</p>
        <nav className="mt-4 flex flex-wrap gap-1.5" aria-label={t(lang, 'language')}>
          {LANGS.map(l => (
            <Link key={l.code} href={visitHref('/visit', l.code)} lang={l.code} hrefLang={l.code} aria-current={l.code === lang ? 'true' : undefined}
              className={`press rounded-full px-3.5 py-2 text-[14px] font-semibold ${l.code === lang ? 'bg-navy text-white' : 'bg-bg text-ink'}`}>{l.label}</Link>
          ))}
        </nav>
      </section>

      <section className="rise card mx-3 mt-3 p-5">
        <h2 className="text-[17px] font-bold">{t(lang, 'visitPopular')}</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {popular.map(b => (
            <li key={b.id}>
              {/* 누르면 바로 길찾기 시작(GPS가 있으면 내 위치, 없으면 정문에서) */}
              <Link href={visitHref('/visit/map', lang, { b: b.id, go: '1' })} className="press flex h-full items-center rounded-2xl bg-bg-soft px-4 py-3 text-[15px] font-semibold leading-snug">
                {buildingName(b, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ul className="mt-3 space-y-3">
        {cards.map(({ href, label, Icon }) => (
          <li key={href} className="rise card mx-3">
            <Link href={href} className="press flex min-h-16 items-center gap-3 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal/10 text-teal" aria-hidden><Icon size={22} weight="fill" /></span>
              <span className="flex-1 text-[16px] font-semibold">{label}</span>
              <CaretRight size={18} className="text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-5 px-6 text-center text-[13px] text-muted">
        {t(lang, 'visitStudentOnly')} · <Link href={`/login?lang=${lang}`} className="font-semibold text-teal">{t(lang, 'login')}</Link>
      </p>
      <p className="mt-2 px-6 text-center text-[12px] leading-relaxed text-muted">{t(lang, 'statsNotice')}</p>
    </VisitShell>
  )
}

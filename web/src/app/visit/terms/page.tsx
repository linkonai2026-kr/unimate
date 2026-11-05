// 이용약관(로그인 없이, 방문객 틀). 언어는 ?lang=
import Link from 'next/link'
import LegalDoc from '@/components/LegalDoc'
import VisitShell from '@/components/VisitShell'
import { guestLang } from '@/lib/auth/session'
import { t } from '@/lib/i18n'
import { visitHref } from '@/lib/visit'

export default async function VisitTerms({ searchParams }: PageProps<'/visit/terms'>) {
  const lang = guestLang((await searchParams).lang)
  return (
    <VisitShell lang={lang} active="home">
      <h1 className="px-5 pt-4 text-[22px] font-bold tracking-tight">{t(lang, 'terms')}</h1>
      <LegalDoc kind="terms" lang={lang} footer={
        <p className="px-6 text-center text-[14px]"><Link href={visitHref('/visit/privacy', lang)} className="font-semibold text-teal">{t(lang, 'privacy')}</Link></p>
      } />
    </VisitShell>
  )
}

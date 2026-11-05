// 이용약관(로그인 뒤). 로그인 전에는 /visit/terms
import Link from 'next/link'
import LegalDoc from '@/components/LegalDoc'
import { requireUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'

export default async function TermsPage() {
  const { lang } = await requireUser()
  return (
    <LegalDoc kind="terms" lang={lang} footer={
      <p className="px-6 text-center text-[14px]">
        <Link href="/privacy" className="font-semibold text-teal">{t(lang, 'privacy')}</Link> · <Link href="/rules" className="font-semibold text-teal">{t(lang, 'rules')}</Link>
      </p>
    } />
  )
}

// 개인정보처리방침(로그인 뒤). 로그인 전에는 /visit/privacy
import Link from 'next/link'
import LegalDoc from '@/components/LegalDoc'
import { requireUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n'

export default async function PrivacyPage() {
  const { lang } = await requireUser()
  return (
    <LegalDoc kind="privacy" lang={lang} footer={
      <p className="px-6 text-center text-[14px]">
        <Link href="/terms" className="font-semibold text-teal">{t(lang, 'terms')}</Link> · <Link href="/rules" className="font-semibold text-teal">{t(lang, 'rules')}</Link>
      </p>
    } />
  )
}

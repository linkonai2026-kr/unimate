// 방문객 학식: 로그인 없이 이번 주 학식을 자기 언어로
import MenuList from '@/components/school/MenuList'
import VisitShell from '@/components/VisitShell'
import { guestLang } from '@/lib/auth/session'

export default async function VisitMenu({ searchParams }: PageProps<'/visit/menu'>) {
  const lang = guestLang((await searchParams).lang)
  return <VisitShell lang={lang} active="menu"><MenuList lang={lang} /></VisitShell>
}

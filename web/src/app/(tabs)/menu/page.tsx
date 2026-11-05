// 이번 주 학식(요일별, 오늘 강조, 메뉴 이름 번역은 키가 있을 때)
import MenuList from '@/components/school/MenuList'
import { requireUser } from '@/lib/auth/session'

export default async function MenuPage() {
  const me = await requireUser()
  return <MenuList lang={me.lang} />
}

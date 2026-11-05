// 방문객 공지: 로그인 없이 삼척캠퍼스 학사·일반 공지를 자기 언어 요약으로(교직원·학부모·지역 주민도)
import NoticeList from '@/components/school/NoticeList'
import VisitShell from '@/components/VisitShell'
import { guestLang } from '@/lib/auth/session'
import { visitHref } from '@/lib/visit'

export default async function VisitNotices({ searchParams }: PageProps<'/visit/notices'>) {
  const sp = await searchParams
  const lang = guestLang(sp.lang)
  const board = sp.b === 'general' ? 'general' : 'academic'
  return (
    <VisitShell lang={lang} active="notices" query={{ b: board }}>
      <NoticeList lang={lang} board={board} boardHref={{ academic: visitHref('/visit/notices', lang, { b: 'academic' }), general: visitHref('/visit/notices', lang, { b: 'general' }) }} />
    </VisitShell>
  )
}

// 삼척캠퍼스 학사·일반 공지(학교 사이트 실제 정보: 본문 앞부분·첨부, 키가 있으면 3줄 요약)
import NoticeList from '@/components/school/NoticeList'
import { requireUser } from '@/lib/auth/session'

export default async function NoticesPage({ searchParams }: PageProps<'/notices'>) {
  const [me, sp] = await Promise.all([requireUser(), searchParams])
  const board = sp.b === 'general' ? 'general' : 'academic'
  return <NoticeList lang={me.lang} board={board} boardHref={{ academic: '/notices?b=academic', general: '/notices?b=general' }} />
}

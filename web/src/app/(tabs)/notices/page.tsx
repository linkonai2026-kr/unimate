// 삼척캠퍼스 학사·일반 공지(학교 사이트 실제 정보: 본문 앞부분·첨부, 키가 있으면 3줄 요약)
import NoticeList from '@/components/school/NoticeList'
import { requireUser } from '@/lib/auth/session'
import { getTaskStore } from '@/lib/deadlines/store'

export default async function NoticesPage({ searchParams }: PageProps<'/notices'>) {
  const [me, sp] = await Promise.all([requireUser(), searchParams])
  const board = sp.b === 'general' ? 'general' : 'academic'
  // 이미 내 마감에 담은 공지는 버튼 대신 "담았어요"를 보여 준다(저장소가 안 되면 버튼을 그대로 둔다)
  const saved = await getTaskStore().list(me.id).then(l => l.map(x => `${x.board}:${x.noticeId}`)).catch(() => [])
  return <NoticeList lang={me.lang} board={board} mode="student" savedIds={saved} boardHref={{ academic: '/notices?b=academic', general: '/notices?b=general' }} />
}

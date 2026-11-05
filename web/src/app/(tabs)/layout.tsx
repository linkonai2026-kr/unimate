// 상단 바와 하단 5개 탭을 두르는 메인 화면 레이아웃(화면 낭독기가 사용자 언어로 읽도록 lang을 붙인다)
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import Tracker from '@/components/Tracker'
import { requireUser } from '@/lib/auth/session'

export default async function TabsLayout({ children }: LayoutProps<'/'>) {
  const { lang } = await requireUser()
  return (
    // 아래 여백: 하단 탭(64px)과 아이폰 홈 바(safe-area)에 넉넉히 더 비워 맨 아래 버튼이 탭에 가려지거나 탭이 터치를 가로채지 않게
    <div lang={lang} className="mx-auto min-h-dvh max-w-[480px] bg-bg-soft pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <TopBar lang={lang} />
      <main>{children}</main>
      <Tracker visitor={false} lang={lang} />
      <BottomNav lang={lang} />
    </div>
  )
}

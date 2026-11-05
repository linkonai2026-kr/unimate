'use client'
// 하단 5개 탭(홈·시간표·게시판·쪽지·지도). 선택된 탭은 채운 아이콘과 네이비. 날짜가 바뀌면 화면을 새로 받는 도우미도 함께 둔다
import { ArrowClockwise, ChatsCircle, House, ListBullets, MapPin, Table } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { t, type Lang, type UiKey } from '@/lib/i18n'
import { kstDay, msToKstMidnight } from '@/lib/school/memo'

// 경로 조각 단위로 맞춘다("/menu-x" 같은 주소가 홈 탭으로 잡히지 않게)
const TABS: { href: string; key: UiKey; match: RegExp; Icon: typeof House }[] = [
  { href: '/', key: 'tab.home', match: /^\/($|(notices|menu)(\/|$))/, Icon: House },
  { href: '/timetable', key: 'tab.timetable', match: /^\/(timetable|lectures|friends|calc)(\/|$)/, Icon: Table },
  { href: '/boards', key: 'tab.board', match: /^\/(boards|board|post|write|search)(\/|$)/, Icon: ListBullets },
  { href: '/messages', key: 'tab.messages', match: /^\/messages(\/|$)/, Icon: ChatsCircle },
  { href: '/map', key: 'tab.map', match: /^\/map(\/|$)/, Icon: MapPin },
]

/**
 * 학식·공지처럼 날짜가 중요한 화면을 열어 둔 채로 둬도 오늘(한국) 정보로 바뀌게 한다(화면에 그리는 것은 없다).
 * day: 서버가 그릴 때의 한국 날짜(YYYY-MM-DD). 한국 자정 직후, 화면으로 돌아왔을 때 날짜가 바뀌었으면, 보이는 동안 30분마다 다시 받는다
 */
export function DayRefresh({ day }: { day: string }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => router.refresh()
    const stale = () => kstDay().iso !== day
    const midnight = setTimeout(refresh, msToKstMidnight() + 5_000)
    const every = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 30 * 60_000)
    const onShow = () => { if (document.visibilityState === 'visible' && stale()) refresh() }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => {
      clearTimeout(midnight)
      clearInterval(every)
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
    }
  }, [day, router])
  return null
}

/** 서버 화면을 다시 받아 그리는 "다시 시도" 버튼(학교 사이트를 못 읽었을 때) */
export function RefreshButton({ label }: { label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} aria-busy={pending} onClick={() => start(() => router.refresh())}
      className="press inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-navy px-5 text-[15px] font-bold text-white disabled:opacity-60">
      <ArrowClockwise size={18} weight="bold" aria-hidden />{label}
    </button>
  )
}

export default function BottomNav({ lang }: { lang: Lang }) {
  const path = usePathname() ?? '/'
  return (
    <nav aria-label="Unimate" className="fixed inset-x-0 bottom-0 z-20 bg-bg/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line)] backdrop-blur">
      <ul className="mx-auto flex max-w-[480px]">
        {TABS.map(({ href, key, match, Icon }) => {
          const on = match.test(path)
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={on ? 'page' : undefined} className={`press flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${on ? 'font-bold text-navy' : 'font-medium text-[#a4abb8]'}`}>
                <Icon size={26} weight={on ? 'fill' : 'regular'} aria-hidden />
                {t(lang, key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

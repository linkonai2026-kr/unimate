'use client'
// 상단 바: 탭 첫 화면은 제목(홈은 로고와 학교 이름), 그 아래 화면은 뒤로 가기 + 제목. 오른쪽에 검색·내 정보
import { CaretLeft, MagnifyingGlass, UserCircle } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { t, type Lang, type UiKey } from '@/lib/i18n'

const TITLES: [RegExp, UiKey][] = [
  [/^\/calc/, 'gpaCalc'], [/^\/timetable\/add/, 'findCourses'], [/^\/timetable\/import/, 'uploadTimetable'], [/^\/timetable/, 'tab.timetable'],
  [/^\/friends/, 'friends'], [/^\/lectures/, 'reviews'], [/^\/(boards|board|post|write|search)(\/|$)/, 'tab.board'], [/^\/messages/, 'tab.messages'],
  [/^\/map/, 'tab.map'], [/^\/me\/edit/, 'editProfile'], [/^\/me\/password/, 'changePassword'], [/^\/me(\/|$)/, 'me'], [/^\/rules/, 'rules'],
  [/^\/notices/, 'notices'], [/^\/menu/, 'weekMenu'], [/^\/deadlines\//, 'applyHelper'],
]
const ROOTS = new Set(['/', '/timetable', '/boards', '/messages', '/map'])

export default function TopBar({ lang }: { lang: Lang }) {
  const path = usePathname() ?? '/'
  const router = useRouter()
  const title = TITLES.find(([re]) => re.test(path))?.[1]
  const sub = !ROOTS.has(path)
  // 주소로 바로 들어와 앞 화면이 없으면 뒤로 가기 대신 홈으로(앱 밖으로 나가지 않게)
  const back = () => (window.history.length > 1 ? router.back() : router.push('/'))
  const icons = (
    <>
      <Link href="/search" aria-label={t(lang, 'search')} className="press flex h-10 w-10 items-center justify-center rounded-full"><MagnifyingGlass size={24} aria-hidden /></Link>
      <Link href="/me" aria-label={t(lang, 'me')} className="press flex h-10 w-10 items-center justify-center rounded-full"><UserCircle size={26} aria-hidden /></Link>
    </>
  )
  // 홈: 왼쪽 큰 로고, 가운데 학교 이름, 오른쪽 아이콘(양옆 칸 너비를 같게 해서 학교 이름이 정확히 가운데)
  if (path === '/') return (
    <header className="sticky top-0 z-10 grid h-16 grid-cols-[1fr_auto_1fr] items-center bg-bg/95 px-3 backdrop-blur">
      <Link href="/" className="press justify-self-start" aria-label="Unimate">
        <Image src="/brand/logo.png" alt="Unimate" width={112} height={27} priority />
      </Link>
      <h1 className="max-w-[44vw] truncate px-2 text-center text-[17px] font-bold tracking-tight">{t(lang, 'campus')}</h1>
      <div className="flex justify-self-end">{icons}</div>
    </header>
  )
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-1 bg-bg/95 px-2 backdrop-blur">
      {sub && <button type="button" onClick={back} aria-label={t(lang, 'back')} className="press flex h-10 w-10 items-center justify-center rounded-full"><CaretLeft size={24} weight="bold" aria-hidden /></button>}
      <h1 className={`flex-1 truncate font-bold tracking-tight ${sub ? 'text-[17px]' : 'px-2 text-[22px]'}`}>{title ? t(lang, title) : ''}</h1>
      {icons}
    </header>
  )
}

// 홈: 지금/다음 수업(강의실 위치·작은 지도·바로 길찾기), 바로가기, 학사공지, 지금 학식, 인기 글, 게시판 최신 글, 최근 강의평
import { BookOpen, CaretRight, Fire, ForkKnife, Megaphone, NavigationArrow, Star, UsersThree } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { Suspense } from 'react'
import Avatar from '@/components/Avatar'
import { DayRefresh } from '@/components/BottomNav'
import LiveRefresh from '@/components/LiveRefresh'
import MiniMap from '@/components/MiniMap'
import MyDeadlines from '@/components/MyDeadlines'
import { Bubble, Heart } from '@/components/PostCard'
import { MenuCard, NoticeCard } from '@/components/SchoolCards'
import { Flag, IconBox, Row, SanctionBanner, Section, type Tone } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { loadBoards, pinsOf } from '@/lib/board/list'
import { postViews } from '@/lib/board/views'
import { dayName, t, type UiKey } from '@/lib/i18n'
import { buildingById, buildingName } from '@/lib/map/buildings'
import { whereText } from '@/lib/map/facilities'
import { kstDay } from '@/lib/school/memo'
import { getStore } from '@/lib/store'
import { pickText } from '@/lib/text'
import { isNew, timeAgo } from '@/lib/time'
import { sanctionStatus } from '@/lib/moderation'
import { nextClass } from '@/lib/timetable/next'
import { parsePlace } from '@/lib/timetable/rooms'
import { fmtMin } from '@/lib/timetable/slots'
import { POPULAR } from '@/lib/visit'

const QUICK: { href: string; key: UiKey; tone: Tone; Icon: typeof Megaphone }[] = [
  { href: '/notices', key: 'notices', tone: 'navy', Icon: Megaphone },
  { href: '/menu', key: 'weekMenu', tone: 'mint', Icon: ForkKnife },
  { href: '/lectures', key: 'reviews', tone: 'star', Icon: Star },
  { href: '/friends', key: 'friends', tone: 'teal', Icon: UsersThree },
]

export default async function Home() {
  const me = await requireUser()
  const lang = me.lang
  const store = getStore()
  const boards = await loadBoards(store, lang)
  // 고정한 순서대로, 지금 있는 게시판만
  const pinned = pinsOf(me).map(id => boards.find(b => b.id === id)).filter(b => b !== undefined)
  const [courses, latestByBoard, popular, hot, reviews] = await Promise.all([
    store.listCourses(me.id),
    Promise.all(pinned.map(async b => ({ b, p: (await store.listPosts({ board: b.id, limit: 1 }))[0] }))),
    store.listPosts({ best: true, limit: 2 }).then(p => postViews(p, me)),
    store.listPosts({ hot: true, limit: 4 }),
    store.listReviews(),
  ])
  const nc = nextClass(courses)
  const room = nc ? parsePlace(nc.course.place) : null
  const bld = buildingById(room?.buildingId)
  const places = POPULAR.map(id => buildingById(id)).filter(b => b !== undefined)

  return (
    <div className="space-y-3 pb-6 pt-1">
      <LiveRefresh topics={['board:all']} />
      {/* 학식·공지는 오늘(한국) 기준: 열어 둔 채 자정이 지나면 새로 받는다 */}
      <DayRefresh day={kstDay().iso} />
      <SanctionBanner lang={lang} status={sanctionStatus(me)} />

      {/* 지금/다음 수업: 한눈에 보고 바로 길찾기 */}
      <section className="rise mx-3 rounded-[24px] bg-navy p-5 text-white">
        <p className="text-[14px] font-medium text-white/70">{t(lang, 'helloName', { name: me.nickname })}</p>
        {nc ? (
          <>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-mint">
              {nc.status === 'now' && <span className="h-2 w-2 animate-pulse rounded-full bg-mint" aria-hidden />}
              {nc.status === 'now' ? t(lang, 'nowClass') : nc.status === 'next' ? t(lang, 'nextClassLabel')
                : nc.inDays === 1 ? t(lang, 'tomorrowClass') : t(lang, 'dayFirstClass', { day: dayName(nc.course.day, lang) })}
            </p>
            <p className="mt-1 text-[26px] font-bold leading-tight tracking-tight">{nc.course.name}</p>
            <p className="mt-1 text-[15px] text-white/80">{fmtMin(nc.course.start)}–{fmtMin(nc.course.end)}{nc.course.place ? ` · ${nc.course.place}` : ''}</p>
            {room && bld && (() => {
              // 지금·오늘 수업이면 바로 안내 시작, 다른 날 수업이면 경로만 미리 본다
              const q = new URLSearchParams({ b: bld.id })
              if (room.roomNo) q.set('room', room.roomNo)
              if (nc.status !== 'later') q.set('go', '1')
              const href = `/map?${q}`
              return (
                <>
                  {/* 강의실 위치: 건물 이름(내 언어), 층·호, 작은 위성 지도 */}
                  <Link href={href} className="press mt-4 block overflow-hidden rounded-2xl bg-white/10">
                    <MiniMap lat={bld.lat} lng={bld.lng} label={buildingName(bld, lang)} />
                    <p className="flex items-baseline gap-2 px-4 py-3 text-[15px] font-semibold">
                      {buildingName(bld, lang)}
                      {(room.floor || room.roomNo) && <span className="text-white/70">· {whereText(lang, room.floor, room.roomNo)}</span>}
                    </p>
                  </Link>
                  <Link href={href} className="press mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl bg-mint text-[16px] font-bold text-navy">
                    <NavigationArrow size={20} weight="fill" aria-hidden />{t(lang, 'route')}
                  </Link>
                </>
              )
            })()}
          </>
        ) : (
          <>
            <p className="mt-3 text-[22px] font-bold tracking-tight">{t(lang, 'noClassToday')}</p>
            <Link href="/timetable" className="press mt-4 inline-flex h-11 items-center gap-1 rounded-2xl bg-white/12 px-4 text-[15px] font-semibold">{t(lang, 'seeTimetable')}<CaretRight size={16} weight="bold" aria-hidden /></Link>
          </>
        )}
      </section>

      {/* 시간표가 없어도 길찾기를 바로 써 볼 수 있게: 자주 찾는 곳을 누르면 그 건물로 안내를 시작한다 */}
      <section className="rise card mx-3 p-5">
        <h2 className="flex items-center gap-1.5 text-[17px] font-bold"><NavigationArrow size={20} weight="fill" className="text-teal" aria-hidden />{t(lang, 'visitPopular')}</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {places.map(b => (
            <li key={b.id}>
              <Link href={`/map?b=${b.id}&go=1`} className="press flex h-full items-center rounded-2xl bg-bg-soft px-4 py-3 text-[15px] font-semibold leading-snug">
                {buildingName(b, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="rise card mx-3 grid grid-cols-4 gap-1 px-2 py-4">
        {QUICK.map(({ href, key, tone, Icon }) => (
          <Link key={href} href={href} className="press flex flex-col items-center gap-2 rounded-2xl py-1 text-center">
            <IconBox tone={tone} size={48}><Icon size={26} weight="fill" /></IconBox>
            <span className="text-[13px] font-medium text-ink">{t(lang, key)}</span>
          </Link>
        ))}
      </nav>

      {/* 공지에서 "신청 준비해 줘"로 담은 마감: 학사공지보다 먼저 */}
      <Suspense fallback={<div className="card mx-3 h-32 animate-pulse" />}><MyDeadlines me={me} /></Suspense>
      <Suspense fallback={<div className="card mx-3 h-44 animate-pulse" />}><NoticeCard lang={lang} /></Suspense>
      <Suspense fallback={<div className="card mx-3 h-40 animate-pulse" />}><MenuCard lang={lang} /></Suspense>

      {popular.length > 0 && (
        <Section title={<span className="flex items-center gap-1.5"><Fire size={20} weight="fill" className="text-danger" aria-hidden />{t(lang, 'livePopular')}</span>}>
          <ul className="pb-2">
            {popular.map(p => (
              <li key={p.id}>
                <Link href={`/post/${p.id}`} className="tap block px-5 py-3">
                  <div className="flex items-center gap-2 text-[13px] text-muted"><Avatar n={p.avatar} photo={p.photo} size={22} /><Flag code={p.nation} size={12} /><span className="font-semibold text-ink">{p.author}</span><span>{timeAgo(p.createdAt, lang)}</span></div>
                  <p className="mt-2 text-[16px] font-bold">{p.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-muted">{p.body}</p>
                  <p className="mt-2 flex gap-3 text-[13px] font-semibold"><span className="text-danger"><Heart /> {p.likes}</span><span className="text-teal"><Bubble /> {p.comments}</span></p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t(lang, 'favBoards')} more="/boards" moreLabel={t(lang, 'more')}>
        {latestByBoard.length === 0 && <p className="px-5 pb-5 pt-2 text-[14px] text-muted">{t(lang, 'noPins')}</p>}
        <ul className="pb-2">
          {latestByBoard.map(({ b, p }) => (
            <li key={b.id}>
              <Link href={`/board/${b.id}`} className="tap flex min-h-12 items-center gap-3 px-5 py-2">
                <span className="w-[6.5rem] shrink-0 truncate text-[15px] font-semibold">{b.name}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-muted">{p ? pickText(p, 'title', p.title, lang).text : ''}</span>
                {p && isNew(p.createdAt) && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">N</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {hot.length > 0 && (
        <Section title={t(lang, 'hotBoard')} more="/board/hot" moreLabel={t(lang, 'more')}>
          <ul className="pb-2">{hot.map(p => <li key={p.id}><Row href={`/post/${p.id}`} title={pickText(p, 'title', p.title, lang).text} right={timeAgo(p.createdAt, lang)} chevron={false} /></li>)}</ul>
        </Section>
      )}

      {reviews.length > 0 && (
        <Section title={t(lang, 'recentReviews')} more="/lectures" moreLabel={t(lang, 'more')}>
          <ul className="pb-2">
            {reviews.slice(0, 3).map(r => (
              <li key={r.id}>
                <Row href={`/lectures/${encodeURIComponent(r.courseName)}`} icon={<IconBox tone="star" size={36}><BookOpen size={20} weight="fill" /></IconBox>}
                  title={<span>{r.courseName} <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-[#b07f00]"><Star size={13} weight="fill" />{r.rating}</span></span>} sub={pickText(r, 'body', r.body, lang).text} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

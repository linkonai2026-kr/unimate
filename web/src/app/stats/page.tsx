// 비공개 사용 통계 화면(/stats?key=…): STATS_KEY가 비었거나 다르면 404. 발표 자료용 숫자와 CSV 내려받기
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { has } from '@/lib/env'
import { LANGS } from '@/lib/i18n'
import { ACTIONS, fmtKst, kstDate, loadStats, statsAllowed, statsRange, type Summary } from '@/lib/metrics'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Unimate 통계', robots: { index: false, follow: false, nocache: true }, referrer: 'no-referrer' }

const s1 = (v: number | null) => (v == null ? '—' : (v / 1000).toFixed(1))
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

const ACTION_LABEL: Record<(typeof ACTIONS)[number], string> = { ics: '캘린더 등록', route: '제출처 길찾기', apply_page: '신청 페이지', prepare: '신청 준비(내 마감에 담기)', original: '원문 보기', mail_draft: '메일 초안 쓰기', mail_open: '메일 앱 열기', mail_copy: '메일 본문 복사' }
const FAIL_LABEL: Record<string, string> = { notice_snapshot: '공지: 학교 사이트 대신 저장본', notice_empty: '공지: 빈 목록', menu_error: '식단: 오류 화면', menu_cached: '식단: 받아 둔 식단' }

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl bg-bg p-5 shadow-sm">
      <h2 className="text-[18px] font-bold">{title}</h2>
      {note && <p className="mt-1 text-[13px] text-muted">{note}</p>}
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full min-w-max border-collapse text-[14px]">
      <thead><tr>{head.map(h => <th key={h} className="border-b border-line px-2 py-1.5 text-left font-semibold text-muted">{h}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={head.length} className="px-2 py-3 text-muted">기록 없음</td></tr>}
        {rows.map((r, i) => <tr key={i} className="border-b border-line/60">{r.map((c, k) => <td key={k} className="px-2 py-1.5 tabular-nums">{c}</td>)}</tr>)}
      </tbody>
    </table>
  )
}

const timeRow = (name: string, desc: string, s: Summary) => [name, desc, s.n, s1(s.median), s1(s.p75), s1(s.p95)]

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const key = one(sp.key)
  if (!statsAllowed(key)) notFound()
  const range = statsRange(one(sp.from), one(sp.to))
  const { stats: s, missing, rows } = await loadStats(range)
  const from = kstDate(range.start), to = kstDate(range.end - 1)
  const q = (type: string) => `/api/stats/csv?${new URLSearchParams({ type, key: key!, from, to })}`
  const maxFunnel = Math.max(1, ...s.funnel.map(f => f.sessions))

  const tiles: [string, number][] = [
    ['세션(브라우저) 전체', s.sessions.total], ['방문객 세션', s.sessions.visitor], ['로그인 세션', s.sessions.member],
    ['공지 열기', s.notices.opens], ['가입', s.signups.total],
  ]

  return (
    <div className="min-h-dvh bg-bg-soft px-6 py-8 text-ink">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <header className="flex flex-wrap items-end gap-4">
          <div className="mr-auto">
            <h1 className="text-[26px] font-bold">Unimate 사용 통계</h1>
            <p className="mt-1 text-[14px] text-muted">기간 {from} ~ {to} (한국 날짜) · 이벤트 {rows.toLocaleString()}건 · 저장소 {has.db ? 'Supabase' : '서버 메모리(재시작하면 사라짐)'}</p>
          </div>
          <form className="flex flex-wrap items-end gap-2 text-[14px]">
            <input type="hidden" name="key" value={key} />
            <label className="flex flex-col gap-1">시작<input type="date" name="from" defaultValue={from} className="rounded-lg border border-line bg-bg px-2 py-1.5 text-[16px]" /></label>
            <label className="flex flex-col gap-1">끝<input type="date" name="to" defaultValue={to} className="rounded-lg border border-line bg-bg px-2 py-1.5 text-[16px]" /></label>
            <button className="rounded-lg bg-navy px-3 py-2 font-semibold text-white">보기</button>
          </form>
          <nav className="flex flex-wrap gap-2 text-[14px] font-semibold">
            <a href={q('events')} className="rounded-lg bg-bg px-3 py-2 shadow-sm">요약 CSV</a>
            <a href={q('users')} className="rounded-lg bg-bg px-3 py-2 shadow-sm">사용자별 CSV</a>
            <a href={q('signups')} className="rounded-lg bg-bg px-3 py-2 shadow-sm">가입자 CSV</a>
          </nav>
        </header>

        {missing && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-[14px] font-semibold text-danger">Supabase에 events 표가 없어 이벤트를 저장하지 못하고 있습니다. supabase/schema.sql 끝의 &quot;익명 사용 통계&quot; 블록을 실행하세요.</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-bg p-4 shadow-sm">
              <p className="text-[13px] text-muted">{label}</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums">{n.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <Section title="걸린 시간(초)" note="중앙값은 절반이 그보다 빨랐다는 뜻, p75는 4명 중 3명이 그 안에 끝냈다는 뜻">
          <Table head={['항목', '뜻', '건수', '중앙값', 'p75', 'p95']} rows={[
            timeRow('첫 화면 → 공지 화면', '세션의 첫 화면을 연 때부터 공지 화면이 열릴 때까지(2시간 이내만)', s.timing.toNotices),
            timeRow('공지 화면 → 첫 공지 열기', '공지 화면이 보인 뒤 처음 공지 카드를 누를 때까지(탭이 가려진 시간 제외)', s.timing.firstOpen),
            timeRow('공지 한 건 읽은 시간', '공지 카드가 화면에 절반 이상 보인 시간(1초 이상만)', s.timing.noticeDwell),
            timeRow('공지 화면 머문 시간', '공지 화면을 보고 있던 시간(탭이 가려진 시간 제외)', s.timing.pageDwell),
          ]} />
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="퍼널(방문객)" note="세션 = 그 단계를 한 브라우저 수, 누적 = 앞 단계를 모두 거친 브라우저 수">
            <Table head={['단계', '세션', '누적', '']} rows={s.funnel.map(f => [
              f.label, f.sessions, f.nested,
              <span key="bar" className="block h-2.5 w-40 rounded-full bg-line"><span className="block h-2.5 rounded-full bg-teal" style={{ width: `${(f.nested / maxFunnel) * 100}%` }} /></span>,
            ])} />
          </Section>
          <Section title="언어" note="화면 언어 = 세션이 마지막으로 본 화면의 언어, 고른 횟수 = 방문객이 언어 버튼을 누른 횟수">
            <Table head={['언어', '화면 언어 세션', '고른 횟수']} rows={LANGS.map(l => [l.label, s.langs.ui[l.code] ?? 0, s.langs.picked[l.code] ?? 0])} />
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="공지 도우미 버튼" note={`공지 카드를 누른 세션 ${s.notices.openSessions}개`}>
            <Table head={['버튼', '누른 횟수']} rows={ACTIONS.map(a => [ACTION_LABEL[a], s.notices.actions[a] ?? 0])} />
          </Section>
          <Section title="화면 열림 시간(초)" note="첫 응답 = 서버가 첫 바이트를 보낼 때까지, DOM 준비·전체 로드 = 첫 접속 화면, 앱 안 이동 = 링크를 누른 뒤 새 화면이 그려질 때까지">
            <Table head={['구분', '항목', '건수', '중앙값', 'p75', 'p95']} rows={(['visitor', 'member'] as const).flatMap(k =>
              ([['ttfb', '첫 응답'], ['dcl', 'DOM 준비'], ['load', '전체 로드'], ['spa', '앱 안 이동']] as const).map(([m, label]) => {
                const x = s.pageLoad[k][m]
                return [k === 'visitor' ? '방문객' : '로그인', label, x.n, s1(x.median), s1(x.p75), s1(x.p95)]
              }))} />
          </Section>
        </div>

        <Section title="서버 작업(성공률·걸린 시간)" note="서버가 직접 잰 시간. 공지 목록은 화면 준비 전체, 나머지는 캐시에 없어 실제로 받아 오거나 AI를 부른 경우만">
          <Table head={['작업', '건수', '성공', '성공률', '중앙값', 'p75', 'p95', '출처']} rows={s.ops.map(o => [
            o.label, o.n, o.ok, pct(o.rate), s1(o.median), s1(o.p75), s1(o.p95), Object.entries(o.sources).map(([k, n]) => `${k} ${n}`).join(' · '),
          ])} />
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="오류·실패 화면" note="오류 = 브라우저 스크립트 오류, 실패 화면 = 학교 사이트가 안 돼 저장본·오류 안내를 보여 준 횟수">
            <Table head={['종류', '건수']} rows={[
              ...Object.entries(s.errors.byType).map(([k, n]) => [k === 'error' ? '스크립트 오류' : '처리 안 된 Promise 거부', n]),
              ...Object.entries(s.errors.fails).map(([k, n]) => [FAIL_LABEL[k] ?? k, n]),
            ]} />
            {s.errors.top.length > 0 && <Table head={['자주 난 오류 메시지', '건수']} rows={s.errors.top.map(e => [<span key="m" className="break-all font-mono text-[12px]">{e.message}</span>, e.n])} />}
          </Section>
          <Section title="일별(한국 날짜)">
            <Table head={['날짜', '세션', '방문객', '로그인', '화면 보기', '공지 열기', '가입']} rows={s.daily.map(d => [d.day, d.sessions, d.visitor, d.member, d.views, d.opens, d.signups])} />
          </Section>
        </div>

        <Section title={`로그인 사용자별 (${s.perUser.length}명)`} note="로그인한 상태의 이벤트에 서버가 세션으로 계정을 붙인 것. 방문객은 익명">
          <Table head={['아이디', '이름(닉네임)', '국적', '언어', '마지막 활동(KST)', '화면 보기', '공지 열기', '공지 열기까지 중앙값(초)']}
            rows={s.perUser.map(u => [u.handle, u.nickname, u.nationality, u.lang, fmtKst(u.lastSeen), u.views, u.opens, s1(u.openMedian)])} />
        </Section>

        <Section title={`가입자 (${s.signups.total}명)`} note={`기간 안에 가입한 계정, 최신 순${s.signups.demoExcluded ? ` · 데모 계정 ${s.signups.demoExcluded}개 제외` : ''}`}>
          <Table head={['가입 시각(KST)', '아이디', '이름(닉네임)', '국적', '언어']} rows={s.signups.rows.map(r => [fmtKst(r.at), r.handle, r.nickname, r.nationality, r.lang])} />
        </Section>
      </div>
    </div>
  )
}

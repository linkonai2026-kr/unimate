// 월~금, 9시~18시 주간 시간표 격자(늦게 끝나는 수업이 있으면 21시까지 늘어남, 블록은 링크가 될 수 있음)
import Link from 'next/link'
import { dayName, type Lang } from '@/lib/i18n'
import { DAYS, SLOT_START, fmtMin, gridEnd } from '@/lib/timetable/slots'

export type GridCourse = { key: string; name: string; place: string; day: number; start: number; end: number; href?: string; highlight?: boolean; color?: number }

export const PALETTE = ['#f28b82', '#a7c96a', '#7aa6e8', '#b39ddb', '#7fd3c1', '#f6c26b', '#f5a26b', '#5bd2b4']
export const colorIndex = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length
const HOUR_PX = 52
const DAY_LIST = Array.from({ length: DAYS }, (_, d) => d)

/** 저장된 색 번호가 팔레트 밖이면 이름으로 정한 색 */
const colorOf = (c: GridCourse) => PALETTE[Number.isInteger(c.color) && c.color! >= 0 && c.color! < PALETTE.length ? c.color! : colorIndex(c.name)]

export default function TimetableGrid({ courses, lang, free }: { courses: GridCourse[]; lang: Lang; free?: { day: number; start: number; end: number }[] }) {
  const end = gridEnd(courses)
  const hours = Array.from({ length: (end - SLOT_START) / 60 }, (_, i) => SLOT_START / 60 + i)
  const top = (min: number) => ((Math.min(Math.max(min, SLOT_START), end) - SLOT_START) / 60) * HOUR_PX
  const shown = courses.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
  return (
    <div className="overflow-hidden rounded-[20px] bg-bg">
      <div className="grid grid-cols-[28px_repeat(5,1fr)] border-b border-line/70 text-center text-[13px] font-semibold text-muted" aria-hidden>
        <span />
        {DAY_LIST.map(d => <span key={d} className="py-2.5">{dayName(d, lang)}</span>)}
      </div>
      <div className="relative grid grid-cols-[28px_repeat(5,1fr)]" style={{ height: hours.length * HOUR_PX }}>
        <div aria-hidden>{hours.map(h => <div key={h} className="border-b border-line/60 pr-1.5 pt-0.5 text-right text-[11px] font-medium text-muted" style={{ height: HOUR_PX }}>{h}</div>)}</div>
        {DAY_LIST.map(d => (
          <div key={d} className="relative border-l border-line/60">
            {hours.map(h => <div key={h} className="border-b border-line/60" style={{ height: HOUR_PX }} aria-hidden />)}
            {free?.filter(f => f.day === d).map(f => (
              <div key={`${f.start}-${f.end}`} className="absolute inset-x-0.5 rounded-md border-2 border-dashed border-mint bg-mint/15" style={{ top: top(f.start), height: top(f.end) - top(f.start) }} aria-hidden />
            ))}
            {shown.filter(c => c.day === d).map(c => {
              // 화면 읽기 프로그램용: "월 09:00–10:30 과목 강의실"
              const label = `${dayName(d, lang)} ${fmtMin(c.start)}–${fmtMin(c.end)} ${c.name}${c.place ? ` ${c.place}` : ''}`
              const height = Math.max(top(c.end) - top(c.start) - 1, 12)
              // 좁은 칸에서 긴 과목명은 세 줄까지만, 강의실은 한 줄로 자르고 아주 낮은 블록(30분)에서는 숨긴다
              const body = (
                <>
                  <p className="line-clamp-3 break-words text-[11px] font-bold leading-tight">{c.name}</p>
                  {height >= 40 && <p className="mt-0.5 truncate leading-tight opacity-90">{c.place}</p>}
                </>
              )
              const cls = `press absolute inset-x-[2px] overflow-hidden rounded-[10px] p-1 text-[10px] text-white ${c.highlight ? 'ring-2 ring-navy ring-offset-1' : ''}`
              const style = { top: top(c.start), height, background: colorOf(c) }
              return c.href
                ? <Link key={c.key} href={c.href} scroll={false} aria-label={label} aria-current={c.highlight ? 'true' : undefined} className={cls} style={style}>{body}</Link>
                : <div key={c.key} role="img" aria-label={label} className={cls} style={style}>{body}</div>
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

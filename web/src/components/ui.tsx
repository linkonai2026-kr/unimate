// 토스식 공통 화면 부품: 흰 덩어리(섹션), 누르기 쉬운 행, 아이콘 상자, 큰 버튼 모양, 국기, 빈 화면, 바닥 시트, 경고·이용 제한 안내
import Link from 'next/link'
import { CaretRight, Globe, ProhibitInset, WarningCircle } from '@phosphor-icons/react/dist/ssr'
import type { ReactNode } from 'react'
import { t, type Lang } from '@/lib/i18n'
import { kstTime, REPEAT_SUSPENSION_DAYS, WARNING_LIMIT, type SanctionStatus } from '@/lib/moderation'

/** 큰 버튼 모양(폼 버튼·링크 공통). 한 화면에 primary는 하나만. 높이는 최소값이라 긴 번역(vi·uz)이 두 줄이 돼도 알약 밖으로 넘치지 않고, 작은 버튼도 손가락 기준 44px */
export const btn = {
  primary: 'press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy px-4 py-2 text-center text-[17px] font-bold leading-tight text-white disabled:opacity-50',
  mint: 'press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-teal px-4 py-2 text-center text-[17px] font-bold leading-tight text-white disabled:opacity-50',
  soft: 'press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-bg-soft px-4 py-2 text-center text-[15px] font-semibold leading-tight text-ink disabled:opacity-50',
  small: 'press inline-flex min-h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-bg-soft px-3 text-[14px] font-semibold text-ink disabled:opacity-50',
  smallPrimary: 'press inline-flex min-h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-navy px-3.5 text-[14px] font-bold text-white disabled:opacity-50',
}

/** 입력칸 모양 */
export const field = 'h-14 w-full rounded-2xl bg-bg-soft px-4 text-[16px] text-ink outline-none placeholder:text-[#a4abb8] focus:bg-bg focus:ring-2 focus:ring-navy/20'

const TONES = {
  navy: 'bg-navy/8 text-navy',
  mint: 'bg-mint-soft text-mint-text',
  teal: 'bg-teal/10 text-teal',
  danger: 'bg-danger/10 text-danger',
  star: 'bg-star/15 text-[#b07f00]',
  gray: 'bg-bg-soft text-muted',
} as const
export type Tone = keyof typeof TONES

export function IconBox({ children, tone = 'navy', size = 40 }: { children: ReactNode; tone?: Tone; size?: number }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-[14px] ${TONES[tone] ?? TONES.navy}`} style={{ width: size, height: size }} aria-hidden>{children}</span>
}

/** 흰 덩어리. 제목은 크고 굵게, 오른쪽에 "더 보기" */
export function Section({ title, more, moreLabel, children, className = '' }: { title?: ReactNode; more?: string; moreLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rise card mx-3 overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5">
          <h2 className="min-w-0 text-[19px] font-bold tracking-tight">{title}</h2>
          {more && (
            <Link href={more} className="press -my-2 flex min-h-11 shrink-0 items-center gap-0.5 px-1 text-[14px] font-medium text-muted">
              {moreLabel}<CaretRight size={14} weight="bold" aria-hidden />
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

/** 새 창으로 여는 외부 주소는 http·https만(javascript: 같은 주소를 막는다) */
const isWebUrl = (href: string) => /^https?:\/\//i.test(href)

/** 누르기 쉬운 한 줄(최소 높이 56px). 왼쪽 아이콘, 제목·보조 글, 오른쪽 값 */
export function Row({ href, icon, title, sub, right, chevron = !!href, external }: { href?: string; icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; chevron?: boolean; external?: boolean }) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{title}</span>
        {sub && <span className="mt-0.5 block truncate text-[13px] text-muted">{sub}</span>}
      </span>
      {right && <span className="max-w-[45%] shrink-0 truncate text-[14px] text-muted">{right}</span>}
      {chevron && <CaretRight size={16} className="shrink-0 text-[#c4c9d2]" weight="bold" aria-hidden />}
    </>
  )
  const cls = 'tap flex min-h-14 items-center gap-3 px-5 py-3'
  if (!href || (external && !isWebUrl(href))) return <div className={cls}>{body}</div>
  return external ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a> : <Link href={href} className={cls}>{body}</Link>
}

const FLAGS = new Set(['kr', 'vn', 'cn', 'uz', 'mn', 'jp', 'us'])

/** 국기(SVG). 모르는 나라는 지구본 */
export function Flag({ code, size = 16 }: { code: string | null | undefined; size?: number }) {
  const label = (code ?? '').trim()
  const c = label.toLowerCase()
  if (!FLAGS.has(c)) return <Globe size={size} className="inline shrink-0 text-muted" role="img" aria-label={label || 'globe'} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/flags/${c}.svg`} alt={label.toUpperCase()} width={Math.round(size * 4 / 3)} height={size} className="inline-block shrink-0 rounded-[3px] ring-1 ring-black/5" style={{ height: size, width: 'auto' }} />
}

/** 비어 있을 때: 무엇을 하면 채워지는지 알려 준다 */
export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <IconBox tone="gray" size={56}>{icon}</IconBox>
      <p className="mt-1 text-[17px] font-bold">{title}</p>
      {desc && <p className="text-[14px] text-muted">{desc}</p>}
      {action && <div className="mt-3 w-full max-w-[240px]">{action}</div>}
    </div>
  )
}

/** 바닥에서 올라오는 시트(서버 렌더, 닫기는 링크). closeLabel은 화면 낭독기용 닫기 이름 */
export function Sheet({ close, closeLabel = 'Close', children }: { close: string; closeLabel?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40">
      <Link href={close} scroll={false} aria-label={closeLabel} className="absolute inset-0" />
      <div role="dialog" aria-modal="true" className="rise relative max-h-[90dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-bg px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
        {children}
      </div>
    </div>
  )
}

/** 메뉴 한 줄 모양(··· 메뉴 안 링크·버튼 공통) */
export const menuItem = 'flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-[15px] font-medium hover:bg-bg-soft focus-visible:bg-bg-soft focus-visible:outline-none'

/** 화면 맨 아래에 붙는 주요 버튼 자리(하단 탭 위) */
export function BottomCTA({ children }: { children: ReactNode }) {
  // 위쪽 흐림 띠는 손가락을 가로채지 않게(그 아래 글·버튼이 눌리도록)
  // 앞의 빈 칸은 버튼 높이만큼 화면 끝을 늘려, 맨 아래 내용이 이 버튼 뒤에 숨지 않고 스크롤로 버튼 위까지 올라오게 한다
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-[480px] bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-3 pt-6"><div className="pointer-events-auto">{children}</div></div>
    </>
  )
}

/** 내 경고·이용 제한 상태 안내(홈·내 정보·글쓰기, 제한 중이면 댓글·쪽지 입력칸 자리). 상태가 없으면 아무것도 그리지 않는다 */
export function SanctionBanner({ lang, status, className = '' }: { lang: Lang; status: SanctionStatus | null; className?: string }) {
  if (!status) return null
  const suspended = status.kind === 'suspended'
  const title = suspended ? t(lang, 'suspendedTitle') : t(lang, status.kind === 'warning' ? 'warnTitle' : 'repeatTitle', { n: status.n })
  const desc = suspended
    ? t(lang, 'suspendedDesc', { until: kstTime(status.until, lang), reason: t(lang, status.rule ? `reason.${status.rule}` : 'reason.other') })
    : status.kind === 'warning' ? t(lang, status.n >= WARNING_LIMIT ? 'warn2Desc' : 'warn1Desc') : t(lang, 'repeatDesc', { days: REPEAT_SUSPENSION_DAYS })
  const Icon = suspended ? ProhibitInset : WarningCircle
  return (
    <div role="status" data-testid="sanction-banner" className={`rise mx-3 flex gap-3 rounded-[20px] p-4 ${suspended ? 'bg-danger/10' : 'bg-star/15'} ${className}`}>
      <Icon size={24} weight="fill" className={`mt-0.5 shrink-0 ${suspended ? 'text-danger' : 'text-[#b07f00]'}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-[15px] font-bold ${suspended ? 'text-danger' : 'text-[#8a6400]'}`}>{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink/80">{desc}</p>
        <Link href="/rules" className="press -mb-2 mt-0.5 inline-flex min-h-11 items-center gap-0.5 text-[13px] font-semibold text-muted">{t(lang, 'seeRules')}<CaretRight size={12} weight="bold" aria-hidden /></Link>
      </div>
    </div>
  )
}

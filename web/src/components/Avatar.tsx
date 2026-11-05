// 프로필 그림: 올린 사진이 있으면 사진, 없으면 고른 색의 기본 그림, 익명이면 회색 기본 그림
const COLORS = ['#011d48', '#27a395', '#5bd2b4', '#f28b82', '#f6c26b', '#7aa6e8', '#b39ddb', '#a7c96a']

export const AVATAR_COUNT = COLORS.length

/** 번호를 색으로(음수·소수·NaN이어도 목록 안의 색) */
const colorOf = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '#e3e6eb' : COLORS[((Math.trunc(n) % COLORS.length) + COLORS.length) % COLORS.length]

export default function Avatar({ n, photo, size = 36 }: { n?: number | null; photo?: string | null; size?: number }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/img/${encodeURIComponent(photo)}`} alt="" width={size} height={size} loading="lazy" decoding="async"
        className="shrink-0 rounded-[30%] bg-bg-soft object-cover" style={{ width: size, height: size }} />
    )
  }
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="shrink-0 rounded-[30%]" aria-hidden="true" focusable="false">
      <rect width="36" height="36" fill={colorOf(n)} />
      <circle cx="18" cy="14" r="6.5" fill="#fff" />
      <path d="M6 33c1.5-7 6.5-10 12-10s10.5 3 12 10z" fill="#fff" />
    </svg>
  )
}

// 학교 사이트 요청 도우미: 한국 날짜 계산, 시간 제한·문자셋을 지키는 HTML 받기, 만료 시간·동시 요청 합치기가 있는 메모리 캐시
export type Fetcher = (url: string) => Promise<string>

const KST_OFFSET = 9 * 3600_000
const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/** 한국 시간(UTC+9, 서머타임 없음)의 날짜. 서버가 UTC여도 같은 값. dow: 0=일 … 6=토 */
export interface KstDay { y: number; m: number; d: number; dow: number; iso: string }
export function kstDay(now: Date | number = Date.now()): KstDay {
  const k = new Date((typeof now === 'number' ? now : now.getTime()) + KST_OFFSET)
  const y = k.getUTCFullYear(), m = k.getUTCMonth() + 1, d = k.getUTCDate()
  return { y, m, d, dow: k.getUTCDay(), iso: `${y}-${pad(m)}-${pad(d)}` }
}

/** 한국 날짜에서 n일 뒤(앞) 날짜 */
export function addDays(day: KstDay, n: number): KstDay {
  return kstDay(Date.UTC(day.y, day.m - 1, day.d + n) - KST_OFFSET)
}

/** 다음 한국 자정까지 남은 시간(ms) */
export const msToKstMidnight = (now = Date.now()) => DAY_MS - ((now + KST_OFFSET) % DAY_MS)

/** content-type의 charset(예: EUC-KR)대로 글자를 푼다. 모르는 charset이면 UTF-8 */
export function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const charset = /charset\s*=\s*"?([\w-]+)/i.exec(contentType ?? '')?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(charset).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

/**
 * 학교 사이트 HTML 받기: 8초 제한, 실패하면 예외(호출 쪽이 스냅샷으로).
 * Next 데이터 캐시는 쓰지 않는다(자정을 넘겨 어제 페이지를 줄 수 있어서). 캐시는 한국 날짜를 키에 넣은 메모리 캐시가 맡는다
 */
export const fetchHtml: Fetcher = async url => {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return decodeBody(await res.arrayBuffer(), res.headers.get('content-type'))
}

/**
 * 만료 시간이 있는 메모리 캐시(대역 결과가 영원히 남지 않게).
 * - 같은 키를 동시에 요청하면 make를 한 번만 부른다
 * - make가 실패하거나 keep이 false면 저장하지 않는다(일시적 실패를 10분 동안 들고 있지 않게)
 * - 항목이 maxEntries를 넘으면 만료된 것, 그다음 오래된 것부터 지운다
 */
export function createMemo(ttlMs: number, now: () => number = Date.now, maxEntries = 500) {
  const store = new Map<string, { at: number; v: unknown }>()
  const pending = new Map<string, Promise<unknown>>()

  function save(key: string, v: unknown) {
    store.delete(key)
    if (store.size >= maxEntries) {
      const t = now()
      for (const [k, e] of store) if (t - e.at > ttlMs) store.delete(k)
      while (store.size >= maxEntries) store.delete(store.keys().next().value as string)
    }
    store.set(key, { at: now(), v })
  }

  return function memo<T>(key: string, make: () => Promise<T>, keep: (v: T) => boolean = () => true): Promise<T> {
    const hit = store.get(key)
    if (hit && now() - hit.at <= ttlMs) return Promise.resolve(hit.v as T)
    const busy = pending.get(key)
    if (busy) return busy as Promise<T>
    const p = (async () => {
      try {
        const v = await make()
        if (keep(v)) save(key, v)
        return v
      } finally {
        pending.delete(key)
      }
    })()
    pending.set(key, p)
    return p
  }
}

// 고정 창 요청 제한(프로세스 메모리). 로그인 없는 길찾기의 외부 API 사용량, 로그인·가입 시도 횟수를 지킬 때 쓴다
export interface Limiter {
  /** 한 번 쓰고, 이번 창에서 limit번 이하면 true */
  (key: string, now?: number): boolean
  /** 쓰지 않고, 이번 창에서 이미 limit번을 채웠는지만 본다 */
  blocked(key: string, now?: number): boolean
}

export function createLimiter({ limit, windowMs, maxKeys = 5000 }: { limit: number; windowMs: number; maxKeys?: number }): Limiter {
  const hits = new Map<string, { start: number; n: number }>()
  const live = (key: string, now: number) => {
    const h = hits.get(key)
    return h && now - h.start < windowMs ? h : undefined
  }
  // 키가 너무 많아지면 지난 창부터, 그래도 넘치면 가장 오래된 창부터 지운다(전부 비우면 공격자가 제한을 풀 수 있다)
  const prune = (now: number) => {
    for (const [k, h] of hits) if (now - h.start >= windowMs) hits.delete(k)
    for (const k of hits.keys()) {
      if (hits.size < maxKeys) break
      hits.delete(k)
    }
  }

  const allow = (key: string, now = Date.now()): boolean => {
    const h = live(key, now)
    if (h) return ++h.n <= limit
    // 새 창은 맨 뒤에 넣어 Map 순서가 창 시작 순서가 되게
    hits.delete(key)
    if (hits.size >= maxKeys) prune(now)
    hits.set(key, { start: now, n: 1 })
    return limit >= 1
  }
  return Object.assign(allow, { blocked: (key: string, now = Date.now()) => (live(key, now)?.n ?? 0) >= limit })
}

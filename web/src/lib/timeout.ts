// 외부 호출이 늦거나 실패하면 대역 값으로 바꿔 주는 래퍼
const LATE = Symbol('late')

export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: () => T | Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<typeof LATE>(resolve => { timer = setTimeout(resolve, ms, LATE) })
  let v: T | typeof LATE
  try {
    v = await Promise.race([p, late])
  } catch (e) {
    console.warn('[withTimeout] fallback:', e instanceof Error ? e.message : e)
    return fallback()
  } finally {
    clearTimeout(timer)
  }
  // 대역은 한 번만 부른다(대역이 던지면 그대로 호출한 쪽으로)
  return v === LATE ? fallback() : v
}

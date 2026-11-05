// 열람자 언어에 맞는 번역문을 고르고, 없으면 원문을 돌려준다
import type { Lang, TrMap } from './types'

export function pickText(item: { lang: Lang; tr?: TrMap | null }, field: string, original: string, viewer: Lang): { text: string; translated: boolean } {
  if (viewer === item.lang) return { text: original, translated: false }
  const text = item.tr?.[viewer]?.[field]
  // 비어 있거나 공백뿐인 번역은 없는 것으로 본다
  return typeof text === 'string' && text.trim() ? { text, translated: true } : { text: original, translated: false }
}

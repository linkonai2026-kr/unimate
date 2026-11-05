// 기본 게시판과 사용자가 만든 게시판을 합친 목록, 사용자별 고정(즐겨찾기) 규칙
import { BOARDS } from '../boards'
import type { Lang } from '../i18n'
import { pickText } from '../text'
import type { Store } from '../store/types'
import type { Board, Profile } from '../types'

export type BoardView = { id: string; name: string; desc: string; anonOnly?: boolean; custom?: boolean }

/** 고정을 한 번도 안 바꾼 사람은 기본 게시판 전부가 고정된 상태 */
export const DEFAULT_PINS: readonly string[] = BOARDS.map(b => b.id)
export const pinsOf = (p: Pick<Profile, 'pins'>): string[] => [...(p.pins ?? DEFAULT_PINS)]
export const togglePin = (pins: string[], id: string) => (pins.includes(id) ? pins.filter(x => x !== id) : [...pins, id])

export function mergeBoards(custom: Board[], lang: Lang): BoardView[] {
  return [
    ...BOARDS.map(b => ({ id: b.id, name: b.name[lang], desc: b.desc[lang], ...('anonOnly' in b && b.anonOnly ? { anonOnly: true } : {}) })),
    ...custom.map(b => ({ id: b.id, name: pickText(b, 'name', b.name, lang).text, desc: pickText(b, 'desc', b.desc, lang).text, custom: true })),
  ]
}

/** 스토어에서 사용자 게시판을 읽어 기본 게시판과 합친다 */
export const loadBoards = async (store: Pick<Store, 'listBoards'>, lang: Lang) => mergeBoards(await store.listBoards(), lang)

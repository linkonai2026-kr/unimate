// "5공학관 컴퓨터멀티미디어실[405호]" 같은 강의실 표기에서 건물·호수·층을 뽑는다
import { BUILDINGS } from '../map/buildings'

/** 긴 이름부터 맞춰 "5공학관"이 "공학관"류 짧은 별칭에 먹히지 않게 */
const NAMES = BUILDINGS.flatMap(b => [b.name, ...b.aliases].map(n => ({ id: b.id, n }))).sort((a, b) => b.n.length - a.n.length)

/** 호수 후보: 대괄호 안 → "405호" → 건물 이름 뒤 처음 나오는 2~4자리 숫자 순 */
const ROOM_PATTERNS = [/\[\s*([A-Z]?\d{2,4})\s*호?\s*\]/i, /([A-Z]?\d{2,4})\s*호/i, /(?:^|[^\d])([A-Z]?\d{2,4})(?!\d)/i]

export function parsePlace(place: string): { buildingId: string | null; roomNo: string | null; floor: number | null } {
  const text = (place ?? '').replace(/\s+/g, ' ').trim()
  const hit = text && (NAMES.find(({ n }) => text.startsWith(n)) ?? NAMES.find(({ n }) => text.includes(n)))
  if (!hit) return { buildingId: null, roomNo: null, floor: null }
  const rest = text.slice(text.indexOf(hit.n) + hit.n.length)
  let roomNo: string | null = null
  for (const re of ROOM_PATTERNS) {
    const m = re.exec(rest)
    if (m) { roomNo = m[1].toUpperCase(); break }
  }
  // 앞에 글자가 붙은 호수(B101 등 지하)는 층을 짐작하지 않는다
  const floor = roomNo && /^\d{3,4}$/.test(roomNo) ? Number(roomNo.slice(0, -2)) : null
  return { buildingId: hit.id, roomNo, floor }
}

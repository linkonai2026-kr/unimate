// 커뮤니티 이용규칙(역설계 index.html의 RULES를 이식, 사용자 언어로 번역)
import { translateList } from '@/lib/ai'
import { requireUser } from '@/lib/auth/session'
import type { Lang } from '@/lib/i18n'

const RULES: [string, string][] = [
  ['서로 존중해요', '특정인이나 집단을 깎아내리는 표현, 욕설, 혐오 표현은 삭제하고 이용을 제한해요. 국적·언어가 다르다는 이유로 무시하는 글도 마찬가지예요.'],
  ['개인정보를 지켜요', '이름, 연락처, 학번처럼 누군가를 알아볼 수 있는 정보를 올리지 마세요. 본인 정보도 마찬가지예요.'],
  ['익명을 악용하지 않아요', '익명이라도 작성 기록은 남아요. 같은 사람인 척하거나 다른 사람을 사칭하면 제재해요.'],
  ['광고와 도배는 안 돼요', '홍보는 동아리·모집 게시판에서만, 같은 글을 여러 번 올리는 건 금지예요.'],
  ['거래는 직접, 조심해서', '중고장터 거래는 사용자끼리 이뤄져요. 선입금은 피하고 교내에서 직접 만나세요.'],
  ['번역은 참고용이에요', '글은 자동으로 번역돼요. 뜻이 애매하면 원문 보기로 확인하고, 오해가 생기면 먼저 물어봐 주세요.'],
]
const SOURCE = RULES.flat()

/**
 * 규칙 문장은 바뀌지 않으니 언어별 번역을 프로세스에 한 번만 받아 둔다(화면을 열 때마다 AI를 부르지 않게).
 * 번역에 실패해 원문이 돌아오면 저장하지 않고 다음에 다시 시도한다
 */
const cache = new Map<Lang, string[]>()
async function rulesIn(lang: Lang): Promise<string[]> {
  const hit = cache.get(lang)
  if (hit) return hit
  const out = await translateList(SOURCE, lang)
  const ok = out.length === SOURCE.length
  if (ok && out !== SOURCE && lang !== 'ko') cache.set(lang, out)
  return ok ? out : SOURCE
}

export default async function RulesPage() {
  const me = await requireUser()
  const texts = await rulesIn(me.lang)
  return (
    <ol className="space-y-3 pb-6 pt-1">
      {RULES.map(([title], i) => (
        <li key={title} className="rise card mx-3 flex gap-4 p-5">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[15px] font-bold text-white">{i + 1}</span>
          <span>
            <span className="block text-[17px] font-bold">{texts[i * 2]}</span>
            <span className="mt-1 block text-[15px] leading-relaxed text-muted">{texts[i * 2 + 1]}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

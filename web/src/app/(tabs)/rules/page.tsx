// 커뮤니티 이용규칙(AI 검수와 같은 규칙 목록, 사용자 언어로 번역)
import { translateList } from '@/lib/ai'
import { requireUser } from '@/lib/auth/session'
import type { Lang } from '@/lib/i18n'
import { RULES } from '@/lib/moderation'

const SOURCE = RULES.flatMap(r => [r.title, r.desc])

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
      {RULES.map(({ title }, i) => (
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

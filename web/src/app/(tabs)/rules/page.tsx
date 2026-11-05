// 커뮤니티 이용규칙(AI 검수와 같은 규칙 목록). 번역은 moderation.ts에 미리 옮겨 둔 것을 써서 AI를 부르지 않는다
import { requireUser } from '@/lib/auth/session'
import { RULES, RULES_TR } from '@/lib/moderation'

export default async function RulesPage() {
  const me = await requireUser()
  const list = me.lang === 'ko' ? RULES : RULES_TR[me.lang]
  return (
    <ol className="space-y-3 pb-6 pt-1">
      {list.map(({ title, desc }, i) => (
        <li key={RULES[i]?.title ?? title} className="rise card mx-3 flex gap-4 p-5">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[15px] font-bold text-white">{i + 1}</span>
          <span className="min-w-0">
            <span className="block text-[17px] font-bold">{title}</span>
            <span className="mt-1 block text-[15px] leading-relaxed text-muted">{desc}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

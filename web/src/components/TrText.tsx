'use client'
// 번역문을 보여 주고 "원문 보기"로 원문과 번갈아 볼 수 있게 하는 텍스트
import { Globe } from '@phosphor-icons/react'
import { useState } from 'react'
import { LANGS, t, type Lang } from '@/lib/i18n'

type Props = { text: string; original: string; translated: boolean; pending?: boolean; from: Lang; viewer: Lang; className?: string; badge?: boolean }

export default function TrText({ text, original, translated, pending, from, viewer, className, badge = true }: Props) {
  const [orig, setOrig] = useState(false)
  const showOrig = orig && translated
  const fromName = LANGS.find(l => l.code === from)?.label ?? from
  return (
    <>
      {/* 화면 낭독기가 알맞은 발음으로 읽도록 보이는 글의 언어를 적는다 */}
      <span lang={showOrig || !translated ? from : viewer} className={`whitespace-pre-wrap break-words ${className ?? ''}`}>{showOrig ? original : text}</span>
      {badge && translated && (
        <button type="button" onClick={() => setOrig(o => !o)} aria-pressed={showOrig} className="press mt-2 flex items-center gap-1 rounded-lg bg-mint-soft px-2 py-1 text-[12px] font-semibold text-mint-text">
          <Globe size={14} weight="bold" aria-hidden />
          {t(viewer, 'translatedFrom', { lang: fromName })} · {showOrig ? t(viewer, 'showTranslation') : t(viewer, 'showOriginal')}
        </button>
      )}
      {badge && pending && !translated && (
        <span role="status" className="mt-2 flex animate-pulse items-center gap-1 text-[12px] text-muted"><Globe size={14} aria-hidden />{t(viewer, 'translating')}…</span>
      )}
    </>
  )
}

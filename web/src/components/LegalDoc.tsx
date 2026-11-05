// 이용약관·개인정보처리방침 본문: 머리말, 조항(번호·제목·본문), 번역 안내. 로그인 뒤 화면과 방문객 화면이 같이 쓴다
import { t, type Lang, type UiKey } from '@/lib/i18n'

export type LegalKind = 'terms' | 'privacy'
/** 문서별 조항 수(i18n의 `terms.N.title`·`terms.N.body` 키와 맞춘다) */
const CLAUSES: Record<LegalKind, number> = { terms: 14, privacy: 12 }

export default function LegalDoc({ kind, lang, footer }: { kind: LegalKind; lang: Lang; footer?: React.ReactNode }) {
  const key = (s: string) => `${kind}.${s}` as UiKey
  return (
    <article className="space-y-3 pb-6 pt-1">
      <p className="rise card mx-3 p-5 text-[15px] leading-relaxed text-muted">{t(lang, key('intro'))}</p>
      <ol className="space-y-3">
        {Array.from({ length: CLAUSES[kind] }, (_, i) => i + 1).map(n => (
          <li key={n} className="rise card mx-3 p-5">
            <h2 className="text-[17px] font-bold leading-snug">{t(lang, key(`${n}.title`))}</h2>
            {/* 줄바꿈으로 문단을 나누고, "- "로 시작하는 줄은 목록처럼 들여쓴다 */}
            <div className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-ink">
              {t(lang, key(`${n}.body`)).split('\n').map((line, j) =>
                line.startsWith('- ')
                  ? <p key={j} className="flex gap-2 pl-1"><span aria-hidden className="shrink-0 text-muted">•</span><span>{line.slice(2)}</span></p>
                  : <p key={j}>{line}</p>,
              )}
            </div>
          </li>
        ))}
      </ol>
      {lang !== 'ko' && <p className="px-6 text-[13px] leading-relaxed text-muted">{t(lang, 'legalNotice')}</p>}
      {footer}
    </article>
  )
}

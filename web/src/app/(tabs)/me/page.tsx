// 내 정보: 프로필 카드, 내 활동 바로가기, 계정·앱 설정·커뮤니티 메뉴, 로그아웃
import { BookmarkSimple, ChatCircleText, Globe, IdentificationCard, Key, NotePencil, PencilSimple, ShieldCheck, SignOut, Translate } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { logout } from '@/app/auth-actions'
import Avatar from '@/components/Avatar'
import { Flag, IconBox, Row, Section } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { LANGS, t } from '@/lib/i18n'
import { nationName } from '@/lib/nations'

const ACTIVITY = [
  ['posts', 'myPosts', NotePencil, 'navy'],
  ['comments', 'myComments', ChatCircleText, 'teal'],
  ['scraps', 'myScraps', BookmarkSimple, 'star'],
] as const

export default async function MePage() {
  const me = await requireUser()
  const lang = me.lang
  return (
    <div className="space-y-3 pb-6 pt-1">
      <section className="rise card mx-3 p-5">
        <div className="flex items-center gap-4">
          <Avatar n={me.avatar ?? 0} photo={me.photo} size={64} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[20px] font-bold tracking-tight"><span className="truncate">{me.nickname}</span><Flag code={me.nationality} size={14} /></p>
            <p className="text-[14px] text-muted">@{me.handle}</p>
            <p className="mt-0.5 truncate text-[14px] text-muted">{[t(lang, 'campus'), me.major, me.year].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <Link href="/me/edit" className="press mt-4 flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-bg-soft text-[15px] font-semibold"><PencilSimple size={18} aria-hidden />{t(lang, 'editProfile')}</Link>
      </section>

      <section className="rise card mx-3 grid grid-cols-3 gap-1 px-2 py-4">
        {ACTIVITY.map(([tab, key, Icon, tone]) => (
          <Link key={tab} href={`/me/activity?tab=${tab}`} className="press flex flex-col items-center gap-2 rounded-2xl py-1">
            <IconBox tone={tone} size={48}><Icon size={24} weight="fill" aria-hidden /></IconBox>
            <span className="text-[13px] font-medium">{t(lang, key)}</span>
          </Link>
        ))}
      </section>

      <Section title={t(lang, 'account')}>
        <ul className="pb-2">
          <li><Row icon={<IconBox tone="gray"><IdentificationCard size={22} aria-hidden /></IconBox>} title={t(lang, 'handle')} right={me.handle} /></li>
          <li><Row href="/me/password" icon={<IconBox tone="gray"><Key size={22} aria-hidden /></IconBox>} title={t(lang, 'changePassword')} /></li>
        </ul>
      </Section>

      <Section title={t(lang, 'appSettings')}>
        <ul className="pb-2">
          <li><Row href="/me/edit" icon={<IconBox tone="mint"><Translate size={22} aria-hidden /></IconBox>} title={t(lang, 'language')} right={LANGS.find(l => l.code === lang)?.label} /></li>
          <li><Row href="/me/edit" icon={<IconBox tone="mint"><Globe size={22} aria-hidden /></IconBox>} title={t(lang, 'nationality')} right={nationName(me.nationality, lang)} /></li>
        </ul>
      </Section>

      <Section title={t(lang, 'community')}>
        <ul className="pb-2">
          <li><Row href="/rules" icon={<IconBox tone="gray"><ShieldCheck size={22} aria-hidden /></IconBox>} title={t(lang, 'rules')} /></li>
        </ul>
      </Section>

      <form action={logout} className="mx-3">
        <button className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-bg text-[16px] font-semibold text-danger"><SignOut size={20} aria-hidden />{t(lang, 'logout')}</button>
      </form>
    </div>
  )
}

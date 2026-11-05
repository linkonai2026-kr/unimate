// 프로필 수정: 프로필 그림, 닉네임, 학과·학번, 국적, 사용 언어 (라벨은 입력칸 위, 저장은 아래 큰 버튼)
import { updateMe } from '@/app/auth-actions'
import Avatar, { AVATAR_COUNT } from '@/components/Avatar'
import PhotoPicker from '@/components/PhotoPicker'
import { BottomCTA, btn, field } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { LANGS, t } from '@/lib/i18n'
import { NATIONS, nationName } from '@/lib/nations'

const label = 'block space-y-2 text-[14px] font-semibold text-muted'

export default async function EditProfilePage() {
  const me = await requireUser()
  const lang = me.lang
  const avatar = me.avatar ?? 0
  return (
    <form action={updateMe} className="space-y-3 pb-40 pt-1">
      <fieldset className="rise card mx-3 p-5">
        <legend className="sr-only">{t(lang, 'profilePhoto')}</legend>
        <p className="text-[14px] font-semibold text-muted" aria-hidden>{t(lang, 'profilePhoto')}</p>
        <PhotoPicker lang={lang} current={me.photo ?? null} avatar={avatar} />
        <p className="mt-5 text-[13px] text-muted" id="avatar-pick">{t(lang, 'orPickColor')}</p>
        <div role="radiogroup" aria-labelledby="avatar-pick" className="mt-2 grid grid-cols-4 gap-3">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <label key={i} className="press flex cursor-pointer justify-center rounded-[22px] p-1 ring-teal has-[:checked]:ring-[3px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-navy">
              <input type="radio" name="avatar" value={i} defaultChecked={avatar === i} aria-label={`${t(lang, 'orPickColor')} ${i + 1}`} className="sr-only" />
              <Avatar n={i} size={60} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="rise card mx-3 space-y-4 p-5">
        <label className={label}>{t(lang, 'nickname')}<input name="nickname" defaultValue={me.nickname} maxLength={20} required autoComplete="nickname" className={field} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>{t(lang, 'majorLabel')}<input name="major" defaultValue={me.major ?? ''} maxLength={30} className={field} /></label>
          <label className={label}>{t(lang, 'yearLabel')}<input name="year" defaultValue={me.year ?? ''} maxLength={10} placeholder="24" className={field} /></label>
        </div>
        <label className={label}>{t(lang, 'nationality')}
          <select name="nationality" defaultValue={me.nationality} className={field}>{NATIONS.map(n => <option key={n} value={n}>{nationName(n, lang)}</option>)}</select>
        </label>
        <label className={label}>{t(lang, 'language')}
          <select name="lang" defaultValue={lang} className={field}>{LANGS.map(l => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}</select>
        </label>
      </div>
      <BottomCTA><button className={btn.primary}>{t(lang, 'save')}</button></BottomCTA>
    </form>
  )
}

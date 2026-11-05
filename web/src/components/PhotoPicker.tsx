'use client'
// 프로필 사진 고르기: 휴대폰에서 가운데를 정사각형으로 잘라 400px JPEG로 줄인 뒤 폼의 photo 입력에 담는다.
// 같은 폼의 그림 색·닉네임·국적·학과·학번을 고치면 저장 전에도 위 미리보기에 바로 보인다
import { Camera, Trash } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import Avatar from '@/components/Avatar'
import { Flag, btn } from '@/components/ui'
import { t, type Lang } from '@/lib/i18n'

const SIDE = 400

async function square(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  try {
    const s = Math.min(bmp.width, bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.max(1, Math.min(SIDE, s))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85))
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } finally {
    bmp.close()
  }
}

type Live = { avatar: number; nickname: string; nationality: string; major: string; year: string }

export default function PhotoPicker({ lang, current, avatar, profile, campus }: { lang: Lang; current: string | null; avatar: number; profile?: Omit<Live, 'avatar'>; campus?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [live, setLive] = useState<Live>({ avatar, nickname: profile?.nickname ?? '', nationality: profile?.nationality ?? '', major: profile?.major ?? '', year: profile?.year ?? '' })
  // 폼의 다른 입력을 고칠 때마다 미리보기를 바꾼다(그림 색·닉네임·국적·학과·학번)
  useEffect(() => {
    const form = input.current?.form
    if (!form) return
    const read = () => {
      const d = new FormData(form)
      const s = (k: string, prev: string) => { const v = d.get(k); return typeof v === 'string' ? v : prev }
      setLive(p => ({ avatar: Number(s('avatar', String(p.avatar))) || 0, nickname: s('nickname', p.nickname), nationality: s('nationality', p.nationality), major: s('major', p.major), year: s('year', p.year) }))
    }
    form.addEventListener('input', read)
    form.addEventListener('change', read)
    return () => { form.removeEventListener('input', read); form.removeEventListener('change', read) }
  }, [])
  const [preview, setPreview] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  // 마지막으로 고른 사진만 쓴다(줄이는 동안 또 고르면 앞 것은 버린다)
  const seq = useRef(0)

  // 미리보기를 바꾸거나 화면을 떠나면 앞 미리보기 주소를 돌려준다
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function pick(f: File | undefined) {
    if (!f?.type.startsWith('image/')) return
    const mine = ++seq.current
    setBusy(true)
    const small = await square(f).catch(() => null)
    if (mine !== seq.current) return
    setBusy(false)
    if (!small || !input.current) return
    const dt = new DataTransfer()
    dt.items.add(small)
    input.current.files = dt.files
    setPreview(URL.createObjectURL(small))
    setRemoved(false)
  }
  function remove() {
    seq.current++
    setBusy(false)
    if (input.current) input.current.value = ''
    setPreview(null)
    setRemoved(true)
  }
  const shown = !removed && (preview || current)

  return (
    <div className="mt-3 flex items-center gap-4">
      {/* 서버로 보내는 실제 입력(줄인 파일이 담김) */}
      <input ref={input} type="file" name="photo" accept="image/*" className="hidden" aria-hidden tabIndex={-1} />
      {removed && <input type="hidden" name="removePhoto" value="on" />}
      {preview && !removed
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded-[30%] object-cover" />
        : <Avatar n={live.avatar} photo={removed ? null : current} size={80} />}
      <div className="flex min-w-0 flex-1 flex-col gap-2" aria-busy={busy}>
        {profile && (
          <div data-testid="profile-preview" aria-live="polite" className="min-w-0">
            <p className="flex items-center gap-1.5 text-[18px] font-bold tracking-tight"><span className="truncate">{live.nickname.trim() || profile.nickname}</span><Flag code={live.nationality} size={13} /></p>
            <p className="truncate text-[13px] text-muted">{[campus, live.major.trim(), live.year.trim()].filter(Boolean).join(' · ')}</p>
          </div>
        )}
        <label className={`${btn.smallPrimary} cursor-pointer focus-within:ring-2 focus-within:ring-navy/20`}>
          <Camera size={16} weight="bold" aria-hidden />{t(lang, 'choosePhoto')}
          <input type="file" accept="image/*" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f) }} />
        </label>
        {shown && <button type="button" onClick={remove} className={`${btn.small} text-danger`}><Trash size={16} aria-hidden />{t(lang, 'removePhoto')}</button>}
      </div>
    </div>
  )
}

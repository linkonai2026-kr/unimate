'use client'
// 프로필 사진 고르기: 휴대폰에서 가운데를 정사각형으로 잘라 400px JPEG로 줄인 뒤 폼의 photo 입력에 담는다
import { Camera, Trash } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import Avatar from '@/components/Avatar'
import { btn } from '@/components/ui'
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

export default function PhotoPicker({ lang, current, avatar }: { lang: Lang; current: string | null; avatar: number }) {
  const input = useRef<HTMLInputElement>(null)
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
        : <Avatar n={avatar} photo={removed ? null : current} size={80} />}
      <div className="flex flex-1 flex-col gap-2" aria-busy={busy}>
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

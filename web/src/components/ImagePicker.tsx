'use client'
// 글쓰기 사진 고르기: 휴대폰에서 긴 변 800px JPEG로 줄인 뒤 폼의 images 입력에 담는다(최대 4장)
import { Camera, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { t, type Lang } from '@/lib/i18n'
import { MAX_IMAGE_PX, MAX_IMAGES } from '@/lib/images'

type Picked = { file: File; url: string }

async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  try {
    const k = Math.min(1, MAX_IMAGE_PX / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * k))
    canvas.height = Math.max(1, Math.round(bmp.height * k))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85))
    return new File([blob], `${file.name.replace(/\.\w+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' })
  } finally {
    bmp.close()
  }
}

export default function ImagePicker({ lang }: { lang: Lang }) {
  const input = useRef<HTMLInputElement>(null)
  // 사진을 줄이는 동안 또 고르거나 지워도 최신 목록을 기준으로 하게 ref에도 둔다
  const current = useRef<Picked[]>([])
  const [files, setFiles] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)

  // 화면을 떠나면 미리보기 주소를 돌려준다
  useEffect(() => () => current.current.forEach(f => URL.revokeObjectURL(f.url)), [])

  function sync(next: Picked[]) {
    current.current = next
    setFiles(next)
    const dt = new DataTransfer()
    next.forEach(f => dt.items.add(f.file))
    if (input.current) input.current.files = dt.files
  }
  async function pick(list: File[]) {
    const room = MAX_IMAGES - current.current.length
    if (room <= 0) return
    setBusy(true)
    try {
      const picked = (await Promise.all(list.filter(f => f.type.startsWith('image/')).slice(0, room).map(async f => {
        const small = await shrink(f).catch(() => null)
        return small && { file: small, url: URL.createObjectURL(small) }
      }))).filter(x => x !== null)
      const left = MAX_IMAGES - current.current.length
      picked.slice(left).forEach(p => URL.revokeObjectURL(p.url))
      sync([...current.current, ...picked.slice(0, left)])
    } finally {
      setBusy(false)
    }
  }
  function remove(url: string) {
    URL.revokeObjectURL(url)
    sync(current.current.filter(f => f.url !== url))
  }

  return (
    <div className="space-y-2">
      {/* 서버로 보내는 실제 입력(줄인 파일이 담김). 고르기는 아래 버튼으로 */}
      <input ref={input} type="file" name="images" multiple accept="image/*" className="hidden" aria-hidden tabIndex={-1} />
      <div className="flex flex-wrap gap-2" aria-busy={busy}>
        {files.map(f => (
          <div key={f.url} className="relative h-20 w-20 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="h-full w-full object-cover" />
            {/* 누르는 영역은 40px, 보이는 동그라미는 24px(손가락으로 쉽게 누르게) */}
            <button type="button" aria-label={t(lang, 'delete')} onClick={() => remove(f.url)} className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white"><X size={14} weight="bold" aria-hidden /></span>
            </button>
          </div>
        ))}
        {files.length < MAX_IMAGES && (
          <label className="press flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-bg-soft text-[12px] font-medium text-muted focus-within:ring-2 focus-within:ring-navy/20">
            <Camera size={24} aria-hidden />{t(lang, 'addPhoto')} {files.length}/{MAX_IMAGES}
            <input type="file" multiple accept="image/*" className="sr-only" disabled={busy}
              onChange={e => { const list = [...(e.target.files ?? [])]; e.target.value = ''; void pick(list) }} />
          </label>
        )}
      </div>
      <p className="text-[12px] text-muted">{t(lang, 'maxPhotos', { n: String(MAX_IMAGES) })}</p>
    </div>
  )
}

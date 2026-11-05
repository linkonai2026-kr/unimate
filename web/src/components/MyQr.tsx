// 내 친구 추가 링크를 담은 QR(서버에서 SVG로 그림)
import { headers } from 'next/headers'
import QRCode from 'qrcode'

/** 프록시 헤더는 "https,http"처럼 여러 값일 수 있어 첫 값만, 이상한 값은 버린다 */
const first = (v: string | null) => v?.split(',')[0]?.trim() || null

async function siteOrigin(): Promise<string> {
  const h = await headers()
  const proto = first(h.get('x-forwarded-proto'))
  const host = first(h.get('x-forwarded-host')) ?? first(h.get('host'))
  const safeHost = host && /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) ? host : 'localhost'
  return `${proto === 'https' || proto === 'http' ? proto : 'http'}://${safeHost}`
}

export default async function MyQr({ handle }: { handle: string }) {
  const url = `${await siteOrigin()}/friends/add?h=${encodeURIComponent(handle)}`
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#011d48', light: '#ffffff' } })
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-56" role="img" aria-label={url} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="break-all text-center text-[12px] text-muted">{url}</p>
    </div>
  )
}

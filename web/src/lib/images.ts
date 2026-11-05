// 게시판·프로필 사진: 파일 앞 바이트로 형식을 판별(이름·브라우저가 준 형식은 믿지 않음)하고 한도를 정한다. 브라우저·서버 공용
export const MAX_IMAGES = 4
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024
/** 브라우저에서 줄일 긴 변(px). 역설계 index.html의 MAX_IMG_PX와 같다 */
export const MAX_IMAGE_PX = 800

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

export function sniffImage(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= PNG.length && PNG.every((v, i) => b[i] === v)) return 'image/png'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp'
  return null
}

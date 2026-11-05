// 업로드 사진 형식 판별(파일 앞 바이트로) 테스트
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sniffImage, MAX_IMAGES, MAX_IMAGE_BYTES } from '@/lib/images'

describe('sniffImage', () => {
  it('PNG·JPEG·WEBP를 앞 바이트로 알아본다', () => {
    expect(sniffImage(readFileSync(new URL('../public/brand/icon-192.png', import.meta.url)))).toBe('image/png')
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg')
    expect(sniffImage(new Uint8Array([...Buffer.from('RIFF'), 1, 2, 3, 4, ...Buffer.from('WEBP')]))).toBe('image/webp')
  })
  it('이름만 그림인 다른 파일(HTML, SVG 등)은 거부', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script>'))).toBeNull()
    expect(sniffImage(new Uint8Array([]))).toBeNull()
  })
  it('글 하나에 4장, 장당 1.5MB까지', () => {
    expect(MAX_IMAGES).toBe(4)
    expect(MAX_IMAGE_BYTES).toBe(1.5 * 1024 * 1024)
  })
})

// Next.js 설정: 이미지 원본 사용, 서버 액션 본문 한도, exFAT 볼륨용 캐시 끄기, Tailwind 로더, 보안 헤더
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // exFAT 볼륨의 ._ 파일이 이미지 최적화 캐시에 섞여 깨진 이미지가 나간다. 로고 몇 장뿐이라 원본 PNG를 그대로 쓴다
  images: { unoptimized: true },
  experimental: {
    // 글쓰기에 사진 4장(장당 최대 1.5MB)까지 함께 보낸다
    serverActions: { bodySizeLimit: '7mb' },
    // exFAT 볼륨이 만드는 ._ 파일 때문에 Turbopack 디스크 캐시가 깨져서 끈다
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig

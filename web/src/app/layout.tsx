// 루트 레이아웃: Pretendard 글꼴과 기본 메타데이터
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({ src: "../fonts/PretendardVariable.woff2", variable: "--font-pretendard", weight: "45 920", display: "swap" });

export const metadata: Metadata = {
  title: "Unimate",
  description: "언어가 달라도 함께 어울리는 캠퍼스 커뮤니티",
  applicationName: "Unimate",
};

// viewportFit: cover — 하단 탭·시트가 쓰는 env(safe-area-inset-bottom)이 아이폰에서 실제 값을 갖게
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

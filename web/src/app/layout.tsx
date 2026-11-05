// 루트 레이아웃: Pretendard 글꼴과 기본 메타데이터
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 원본 Pretendard(2MB)에서 라틴·베트남어·키릴·기호와 자주 쓰는 한글 2,350자(KS X 1001)만 남긴 파일(0.66MB).
// 나머지 한글은 globals.css의 "Pretendard Rare Hangul"이 그 글자가 화면에 나올 때만 받는다
const pretendard = localFont({ src: "../fonts/PretendardCore.woff2", variable: "--font-pretendard", weight: "45 920", display: "swap" });

export const metadata: Metadata = {
  title: "Unimate",
  description: "언어가 달라도 함께 어울리는 캠퍼스 커뮤니티",
  applicationName: "Unimate",
};

// viewportFit: cover — 하단 탭·시트가 쓰는 env(safe-area-inset-bottom)이 아이폰에서 실제 값을 갖게
// interactiveWidget: resizes-content — 안드로이드 크롬에서 키보드가 올라오면 화면이 줄어 fixed 입력창·탭이 키보드 위로 올라온다
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

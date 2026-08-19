import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "화공 공지 모아보기 · 영남대 화학공학부",
  description:
    "영남대학교 화학공학부 학생을 위한 학교 공지 통합·맞춤 추천 서비스. 흩어진 게시판을 한곳에서 보고, 학년·관심 분야에 맞는 공지를 먼저 확인하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

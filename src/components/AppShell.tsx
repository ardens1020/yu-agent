import type { ReactNode } from "react";
import { Header } from "./Header";
import { getSessionUser } from "@/lib/session";

/** 학생 화면 공통 레이아웃 (헤더 + 본문 컨테이너) */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted">
        영남대학교 화학공학부 공지 통합 서비스 · 모든 공지의 원문은 영남대학교 공식 게시판에 있습니다.
      </footer>
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "./AdminLogoutButton";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/sources", label: "출처 관리" },
  { href: "/admin/crawls", label: "수집 상태" },
  { href: "/admin/duplicates", label: "중복 검토" },
  { href: "/admin/notices", label: "공지 수정" },
  { href: "/admin/feedback", label: "피드백" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/admin" className="font-bold whitespace-nowrap">
            관리자 <span className="text-accent">콘솔</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notices" className="text-sm text-muted hover:text-foreground">
              학생 화면
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}

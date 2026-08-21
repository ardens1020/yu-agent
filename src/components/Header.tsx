import Link from "next/link";
import { NotificationBell } from "./NotificationBell";
import { LogoutButton } from "./LogoutButton";
import { prisma } from "@/lib/db";
import { ensureDeadlineNotifications } from "@/lib/notify";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/notices", label: "공지" },
  { href: "/saved", label: "저장" },
  { href: "/alerts", label: "알림 설정" },
  { href: "/profile", label: "프로필" },
];

export async function Header({ user }: { user: SessionUser | null }) {
  // 저장 공지 마감 알림(D-3/D-1/당일)을 먼저 갱신한 뒤 미읽음 개수를 센다.
  if (user) await ensureDeadlineNotifications(user.id);
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, isRead: false } })
    : 0;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href={user ? "/notices" : "/"} className="font-bold whitespace-nowrap">
          화공 공지 <span className="text-accent">모아보기</span>
        </Link>

        {user ? (
          <>
            <nav className="ml-2 hidden gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell initialUnread={unread} />
              <LogoutButton />
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/login" className="text-sm text-muted hover:text-foreground">
              관리자
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white dark:text-[#0e0f12]"
            >
              로그인
            </Link>
          </div>
        )}
      </div>

      {user ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

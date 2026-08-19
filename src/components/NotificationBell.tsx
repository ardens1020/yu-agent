"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Item {
  id: string;
  reason: string;
  isRead: boolean;
  createdAt: string;
  noticeId: string;
  title: string;
  sourceName: string;
}

/**
 * n34 알림 목록 패널 → n36 알림에서 공지로 이동.
 * 안 읽은 개수는 서버(Header)에서 받아 초기 렌더에 바로 표시하고,
 * 목록은 패널을 열 때만 가져온다.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications");
      if (response.ok) {
        const data = (await response.json()) as { items: Item[]; unreadCount: number };
        setItems(data.items);
        setUnread(data.unreadCount);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({}) });
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={`알림${unread > 0 ? ` ${unread}건 안 읽음` : ""}`}
        aria-expanded={open}
        className="relative rounded-lg border border-border bg-surface px-2.5 py-2 text-sm hover:bg-surface-muted"
      >
        알림
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[1.15rem] rounded-full bg-accent px-1 text-[0.65rem] font-bold leading-[1.15rem] text-white dark:text-[#0e0f12]">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">알림</span>
            <div className="flex gap-2">
              {unread > 0 ? (
                <button type="button" onClick={markAllRead} className="text-xs text-accent">
                  모두 읽음
                </button>
              ) : null}
              <Link href="/alerts" className="text-xs text-muted hover:text-foreground">
                설정
              </Link>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading || !loaded ? (
              <p className="px-3 py-6 text-center text-sm text-muted">불러오는 중…</p>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted">
                <p>아직 알림이 없습니다.</p>
                <Link href="/alerts" className="mt-1 inline-block text-accent">
                  알림 기준 설정하기
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/notices/${item.noticeId}`}
                      onClick={() => {
                        void fetch("/api/notifications", {
                          method: "PATCH",
                          body: JSON.stringify({ id: item.id }),
                        });
                        setOpen(false);
                      }}
                      className={`block px-3 py-2.5 hover:bg-surface-muted ${
                        item.isRead ? "" : "bg-accent-soft/40"
                      }`}
                    >
                      <p className="text-sm leading-snug">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {item.sourceName} · {item.reason}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

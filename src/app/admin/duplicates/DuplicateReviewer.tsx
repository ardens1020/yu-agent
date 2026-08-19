"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, buttonStyles, formatDate } from "@/components/ui";

interface Side {
  id: string;
  title: string;
  sourceName: string;
  publishedAt: string;
  originUrl: string;
  isHidden: boolean;
  views: number;
}

export interface DuplicateItem {
  id: string;
  score: number;
  status: string;
  a: Side;
  b: Side;
}

/** n53 중복 후보 공지 목록 — 통합(한쪽 숨김) 또는 다른 공지로 확정 */
export function DuplicateReviewer({ items }: { items: DuplicateItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(id: string, status: "MERGED" | "DISTINCT", hideNoticeId?: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/duplicates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, hideNoticeId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "처리에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function SideCard({ side, item }: { side: Side; item: DuplicateItem }) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{side.sourceName}</Badge>
          {side.isHidden ? <Badge tone="danger">숨김</Badge> : null}
        </div>
        <p className="text-sm font-medium leading-snug">{side.title}</p>
        <p className="mt-1 text-xs text-muted">
          {formatDate(side.publishedAt)} · 조회 {side.views.toLocaleString("ko-KR")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <a
            href={side.originUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted"
          >
            원문 ↗
          </a>
          {item.status === "PENDING" ? (
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => resolve(item.id, "MERGED", side.id)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-danger hover:bg-surface-muted disabled:opacity-60"
            >
              이쪽 숨기고 통합
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">유사도 {(item.score * 100).toFixed(0)}%</span>
              <Badge
                tone={
                  item.status === "PENDING" ? "warning" : item.status === "MERGED" ? "success" : "neutral"
                }
              >
                {item.status === "PENDING" ? "검토 대기" : item.status === "MERGED" ? "통합됨" : "다른 공지"}
              </Badge>
            </div>
            {item.status === "PENDING" ? (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => resolve(item.id, "DISTINCT")}
                className={buttonStyles.secondary}
              >
                {busyId === item.id ? "처리 중…" : "서로 다른 공지"}
              </button>
            ) : null}
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            <SideCard side={item.a} item={item} />
            <SideCard side={item.b} item={item} />
          </div>
        </div>
      ))}
    </div>
  );
}

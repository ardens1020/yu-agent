"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, buttonStyles, formatDate } from "@/components/ui";

export interface AdminNoticeRow {
  id: string;
  title: string;
  sourceName: string;
  publishedAt: string;
  originUrl: string;
  /** -1 = 상세 수집 실패(null), 0 = 본문이 실제로 없음 */
  bodyLength: number;
  attachmentCount: number;
  summary: string | null;
  isHidden: boolean;
  adminNote: string | null;
  enriched: boolean;
  feedbackCount: number;
}

/** n56 공지 숨김·수정 처리 */
export function NoticeEditor({ items }: { items: AdminNoticeRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", summary: "", adminNote: "" });
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, data: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "처리에 실패했습니다.");
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(item: AdminNoticeRow) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      summary: item.summary ?? "",
      adminNote: item.adminNote ?? "",
    });
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-2.5">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{item.sourceName}</Badge>
            {item.isHidden ? <Badge tone="danger">숨김</Badge> : null}
            {item.bodyLength < 0 ? (
              <Badge tone="warning">상세 수집 실패</Badge>
            ) : item.bodyLength === 0 ? (
              <Badge tone="warning">본문 없음</Badge>
            ) : null}
            {item.attachmentCount === 0 && item.bodyLength <= 0 ? (
              <Badge tone="danger">정보 없음</Badge>
            ) : null}
            {item.feedbackCount > 0 ? <Badge>피드백 {item.feedbackCount}</Badge> : null}
            {item.enriched ? <Badge tone="success">요약됨</Badge> : <Badge>요약 대기</Badge>}
          </div>

          <p className="font-medium leading-snug">{item.title}</p>
          <p className="mt-1 text-xs text-muted">
            {formatDate(item.publishedAt)} · 본문{" "}
            {item.bodyLength < 0 ? "수집 실패" : `${item.bodyLength}자`} · 첨부 {item.attachmentCount}
          </p>
          {item.summary ? <p className="mt-1.5 text-sm text-muted">{item.summary}</p> : null}
          {item.adminNote ? (
            <p className="mt-1.5 text-sm text-warning">관리자 메모: {item.adminNote}</p>
          ) : null}

          {editingId === item.id ? (
            <div className="mt-3 space-y-2.5 border-t border-border pt-3">
              <label className="block text-sm">
                <span className="text-muted">제목</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">요약 (비우면 본문 발췌로 표시)</span>
                <textarea
                  value={draft.summary}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  rows={3}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">관리자 메모 (학생 화면에는 보이지 않음)</span>
                <input
                  value={draft.adminNote}
                  onChange={(event) => setDraft({ ...draft, adminNote: event.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() =>
                    patch(item.id, {
                      title: draft.title,
                      summary: draft.summary,
                      adminNote: draft.adminNote,
                    })
                  }
                  className={buttonStyles.primary}
                >
                  {busyId === item.id ? "저장 중…" : "수정 저장"}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={buttonStyles.ghost}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <a
                href={item.originUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted"
              >
                원문 ↗
              </a>
              <a
                href={`/notices/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted"
              >
                학생 화면 ↗
              </a>
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted"
              >
                수정
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => patch(item.id, { isHidden: !item.isHidden })}
                className={`rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted disabled:opacity-60 ${
                  item.isHidden ? "" : "text-danger"
                }`}
              >
                {item.isHidden ? "숨김 해제" : "숨기기"}
              </button>
              {item.enriched ? (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => patch(item.id, { clearEnrichment: true })}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted disabled:opacity-60"
                >
                  요약 다시 생성
                </button>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

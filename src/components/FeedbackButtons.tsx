"use client";

import { useState } from "react";
import { FEEDBACK_KINDS } from "@/lib/taxonomy";

/** n20 추천 피드백 선택 */
export function FeedbackButtons({ noticeId }: { noticeId: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(kind: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/notices/${noticeId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (response.ok) setSent(kind);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-success">
        의견을 보냈습니다. 추천과 요약 품질 개선에 사용됩니다.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">이 공지가 도움이 되었나요?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FEEDBACK_KINDS.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={busy}
            onClick={() => send(item.key)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

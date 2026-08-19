"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "./ui";

/** n19 공지 저장 토글 / n30 저장 취소 */
export function SaveButton({
  noticeId,
  initialSaved,
  onUnsaved,
}: {
  noticeId: string;
  initialSaved: boolean;
  /** 저장 목록 화면에서 취소하면 목록을 새로고침한다 */
  onUnsaved?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !saved;
    try {
      const response = await fetch(`/api/notices/${noticeId}/save`, {
        method: next ? "POST" : "DELETE",
      });
      if (response.ok) {
        setSaved(next);
        if (onUnsaved && !next) router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className={saved ? buttonStyles.primary : buttonStyles.secondary}
    >
      {saved ? "저장됨" : "저장"}
    </button>
  );
}

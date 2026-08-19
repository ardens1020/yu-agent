"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "@/components/ui";

/** n40 프로필 초기화 실행 → n41 초기화 확인 완료? → 온보딩(n8) 또는 프로필(n37) */
export function ResetProfileButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", { method: "DELETE" });
      if (!response.ok) {
        setError("초기화에 실패했습니다.");
        return;
      }
      // 초기화하면 온보딩부터 다시 시작한다.
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.danger}>
        프로필 초기화
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="프로필 초기화 확인"
      className="rounded-lg border border-border bg-surface-muted p-3"
    >
      <p className="text-sm font-medium">정말 초기화할까요?</p>
      <p className="mt-1 text-sm text-muted">
        학년·학업 상태·관심 분야와 알림 설정, 받은 알림이 삭제됩니다. 되돌릴 수 없습니다.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={reset} disabled={busy} className={buttonStyles.danger}>
          {busy ? "초기화 중…" : "초기화하고 다시 설정"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className={buttonStyles.ghost}
        >
          취소
        </button>
      </div>
    </div>
  );
}

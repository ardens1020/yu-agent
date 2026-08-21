"use client";

import { useRouter } from "next/navigation";

/** 관리자 화면 공통 뒤로가기. 히스토리가 없으면(북마크·새 탭 진입) 대시보드로 보낸다. */
export function AdminBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/admin");
      }}
      aria-label="뒤로 가기"
      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted"
    >
      ← 뒤로
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted"
    >
      로그아웃
    </button>
  );
}

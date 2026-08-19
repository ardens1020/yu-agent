"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "@/components/ui";

/** n43 관리자 로그인 제출 → n44 대시보드 */
export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          관리자 비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
        />
        <p className="mt-1.5 text-xs text-muted">
          환경변수 ADMIN_PASSWORD로 설정합니다.
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={busy || !password} className={`${buttonStyles.primary} w-full`}>
        {busy ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}

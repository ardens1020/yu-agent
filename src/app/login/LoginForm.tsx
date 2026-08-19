"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "@/components/ui";

/** n6 로그인 정보 제출 → n7 프로필 설정 여부에 따라 분기 */
export function LoginForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name }),
      });
      const data = (await response.json()) as { needsOnboarding?: boolean; error?: string };
      if (!response.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      router.push(data.needsOnboarding ? "/onboarding" : "/notices");
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
        <label htmlFor="studentId" className="block text-sm font-medium">
          학번
        </label>
        <input
          id="studentId"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          autoComplete="username"
          placeholder="예: 22012345"
          required
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          이름 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          placeholder="화면 인사에만 사용됩니다"
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button type="submit" disabled={busy || studentId.length < 6} className={`${buttonStyles.primary} w-full`}>
        {busy ? "확인 중…" : "시작하기"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACADEMIC_STATUSES, INTERESTS } from "@/lib/taxonomy";
import { buttonStyles } from "./ui";

export interface ProfileInitial {
  name: string | null;
  grade: number | null;
  academicStatus: string | null;
  interests: string[];
}

const GRADES = [1, 2, 3, 4, 5];

/** n9 학년·학업상태 선택 + n10 관심 분야 선택 목록 + n11/n39 저장 제출 */
export function ProfileForm({
  initial,
  submitLabel,
  redirectTo,
}: {
  initial: ProfileInitial;
  submitLabel: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [grade, setGrade] = useState<number | null>(initial.grade);
  const [status, setStatus] = useState<string | null>(initial.academicStatus);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleInterest(key: string) {
    setInterests((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade, academicStatus: status, interests }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setSaved(true);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">학년</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {GRADES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={grade === value}
              onClick={() => setGrade(grade === value ? null : value)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                grade === value
                  ? "border-accent bg-accent-soft font-medium text-accent"
                  : "border-border bg-background hover:bg-surface-muted"
              }`}
            >
              {value === 5 ? "5학년 이상" : `${value}학년`}
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm font-medium">학업 상태</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACADEMIC_STATUSES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={status === item.key}
              onClick={() => setStatus(status === item.key ? null : item.key)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                status === item.key
                  ? "border-accent bg-accent-soft font-medium text-accent"
                  : "border-border bg-background hover:bg-surface-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">
          관심 분야 <span className="font-normal text-muted">복수 선택</span>
        </legend>
        <p className="mt-1 text-sm text-muted">
          선택한 분야의 키워드가 제목이나 본문에 있으면 추천 점수가 올라갑니다.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest.key);
            return (
              <button
                key={interest.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleInterest(interest.key)}
                className={`rounded-lg border p-3 text-left ${
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-background hover:bg-surface-muted"
                }`}
              >
                <span className={`text-sm font-medium ${active ? "text-accent" : ""}`}>
                  {interest.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{interest.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">
          이름 <span className="font-normal text-muted">(선택)</span>
        </legend>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="화면 인사에만 사용됩니다"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
        />
      </fieldset>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved && !error ? <p className="text-sm text-success">저장했습니다.</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonStyles.primary}>
          {busy ? "저장 중…" : submitLabel}
        </button>
        <p className="self-center text-xs text-muted">
          선택하지 않아도 통합 목록은 볼 수 있습니다.
        </p>
      </div>
    </form>
  );
}

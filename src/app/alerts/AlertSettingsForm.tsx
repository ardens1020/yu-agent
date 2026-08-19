"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "@/components/ui";
import { INTERESTS } from "@/lib/taxonomy";

interface Initial {
  enabled: boolean;
  keywords: string[];
  interests: string[];
  sourceIds: string[];
  minScore: number;
}

/** n32 알림 설정 정보 → n33 알림 기준 저장 */
export function AlertSettingsForm({
  sources,
  userInterests,
  notificationCount,
  initial,
}: {
  sources: Array<{ id: string; name: string }>;
  userInterests: string[];
  notificationCount: number;
  initial: Initial;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords);
  const [keywordInput, setKeywordInput] = useState("");
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [sourceIds, setSourceIds] = useState<string[]>(initial.sourceIds);
  const [minScore, setMinScore] = useState(initial.minScore);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usesScoreOnly = keywords.length === 0 && interests.length === 0;

  function addKeyword() {
    const value = keywordInput.trim();
    if (value.length < 2) {
      setError("키워드는 2자 이상 입력해 주세요.");
      return;
    }
    if (keywords.includes(value)) {
      setKeywordInput("");
      return;
    }
    setKeywords([...keywords, value]);
    setKeywordInput("");
    setError(null);
  }

  function toggle(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/alerts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, keywords, interests, sourceIds, minScore }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setMessage("알림 기준을 저장했습니다. 다음 수집부터 적용됩니다.");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          <span className="font-medium">알림 받기</span>
        </label>
        <p className="mt-1.5 text-sm text-muted">
          현재까지 받은 알림 {notificationCount}건. 끄면 새 알림이 쌓이지 않습니다.
        </p>
      </div>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">키워드</legend>
        <p className="mt-1 text-sm text-muted">
          제목이나 본문에 이 단어가 있으면 알립니다. 예: 장학, 현장실습, 삼성
        </p>
        <div className="mt-2.5 flex gap-2">
          <input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addKeyword();
              }
            }}
            placeholder="키워드 입력 후 Enter"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="button" onClick={addKeyword} className={buttonStyles.secondary}>
            추가
          </button>
        </div>
        {keywords.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keywords.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => setKeywords(keywords.filter((k) => k !== keyword))}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-sm hover:bg-surface-muted"
                aria-label={`${keyword} 키워드 삭제`}
              >
                {keyword}
                <span className="text-muted">×</span>
              </button>
            ))}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">관심 분야</legend>
        <p className="mt-1 text-sm text-muted">
          프로필 관심 분야와 별개로, 알림을 받을 분야만 고를 수 있습니다.
          {userInterests.length > 0 ? " 프로필 설정값이 기본으로 채워져 있습니다." : ""}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest.key);
            return (
              <button
                key={interest.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(interests, setInterests, interest.key)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  active
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-border bg-background hover:bg-surface-muted"
                }`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">게시판 제한 (선택)</legend>
        <p className="mt-1 text-sm text-muted">
          고르지 않으면 모든 게시판에서 알립니다.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {sources.map((source) => {
            const active = sourceIds.includes(source.id);
            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(sourceIds, setSourceIds, source.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  active
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-border bg-background hover:bg-surface-muted"
                }`}
              >
                {source.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-medium">추천 점수 기준</legend>
        <p className="mt-1 text-sm text-muted">
          {usesScoreOnly
            ? "키워드와 관심 분야를 고르지 않았으므로, 추천 점수가 이 값 이상인 공지를 알립니다."
            : "키워드·관심 분야 조건이 있을 때는 이 값을 쓰지 않습니다."}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
            disabled={!usesScoreOnly}
            className="w-full accent-[var(--accent)] disabled:opacity-50"
          />
          <span className="w-12 shrink-0 text-right text-sm font-medium">{minScore}점</span>
        </div>
      </fieldset>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}

      <button type="submit" disabled={busy} className={buttonStyles.primary}>
        {busy ? "저장 중…" : "알림 기준 저장"}
      </button>
    </form>
  );
}

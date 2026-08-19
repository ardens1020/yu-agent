"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "./ui";
import { sourceCategoryLabel } from "@/lib/taxonomy";

interface SourceOption {
  id: string;
  name: string;
  category: string;
}

/** n21 공지 필터·검색 패널 (n22 필터 조건 적용, n24 키워드 검색 실행) */
export function FilterPanel({
  sources,
  initial,
}: {
  sources: SourceOption[];
  initial: { q: string; sourceId: string; category: string; from: string; to: string; hasAttachment: boolean };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initial.q);
  const [sourceId, setSourceId] = useState(initial.sourceId);
  const [category, setCategory] = useState(initial.category);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [hasAttachment, setHasAttachment] = useState(initial.hasAttachment);
  const [open, setOpen] = useState(
    Boolean(initial.sourceId || initial.category || initial.from || initial.to || initial.hasAttachment),
  );

  const categories = [...new Set(sources.map((s) => s.category))];
  const hasFilters = Boolean(sourceId || category || from || to || hasAttachment || q);

  function apply(event?: React.FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (sourceId) params.set("source", sourceId);
    if (category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (hasAttachment) params.set("attach", "1");
    // 필터가 바뀌면 항상 1페이지로 돌아간다.
    router.push(`/notices${params.size > 0 ? `?${params}` : ""}`);
  }

  function reset() {
    setQ("");
    setSourceId("");
    setCategory("");
    setFrom("");
    setTo("");
    setHasAttachment(false);
    router.push("/notices");
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form onSubmit={apply} className="rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="공지 제목·본문 검색"
          aria-label="키워드 검색"
          className={inputClass}
        />
        <button type="submit" className={buttonStyles.primary}>
          검색
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={buttonStyles.secondary}
        >
          필터
        </button>
      </div>

      {open ? (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted">출처</span>
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">전체 게시판</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-muted">분류</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">전체 분류</option>
              {categories.map((key) => (
                <option key={key} value={key}>
                  {sourceCategoryLabel(key)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-muted">게시일 시작</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="text-sm">
            <span className="text-muted">게시일 종료</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={hasAttachment}
              onChange={(event) => setHasAttachment(event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            <span>첨부파일이 있는 공지만</span>
          </label>

          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={buttonStyles.primary}>
              조건 적용
            </button>
            {hasFilters ? (
              <button type="button" onClick={reset} className={buttonStyles.ghost}>
                초기화
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {searchParams.get("q") ? (
        <p className="mt-2 text-xs text-muted">
          &quot;{searchParams.get("q")}&quot; 검색 결과를 보고 있습니다.
        </p>
      ) : null}
    </form>
  );
}

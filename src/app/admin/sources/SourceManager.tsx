"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, buttonStyles, formatDate } from "@/components/ui";
import { SOURCE_CATEGORIES, sourceCategoryLabel } from "@/lib/taxonomy";

export interface SourceRow {
  id: string;
  name: string;
  listPath: string;
  siteId: string;
  boardNo: string;
  category: string;
  isActive: boolean;
  noticeCount: number;
  lastCrawledAt: string | null;
}

interface CrawlOutcome {
  sourceName: string;
  status: string;
  fetched: number;
  created: number;
  updated: number;
  errorMessage: string | null;
}

export function SourceManager({ initialSources }: { initialSources: SourceRow[] }) {
  const router = useRouter();
  const [sources] = useState(initialSources);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<CrawlOutcome[] | null>(null);

  // 신규 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", listPath: "", boardNo: "", category: "DEPT" });

  async function patch(id: string, data: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "수정에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  /** n49 수동 수집 실행 */
  async function crawl(sourceId?: string) {
    setBusyId(sourceId ?? "ALL");
    setError(null);
    setMessage(null);
    setOutcomes(null);
    try {
      const response = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, pages: 2 }),
      });
      const result = (await response.json()) as {
        error?: string;
        outcomes?: CrawlOutcome[];
        duplicates?: number;
        notifications?: number;
      };
      if (!response.ok) {
        setError(result.error ?? "수집에 실패했습니다.");
        return;
      }
      setOutcomes(result.outcomes ?? []);
      setMessage(
        `수집 완료 — 중복 후보 ${result.duplicates ?? 0}건, 알림 ${result.notifications ?? 0}건 생성`,
      );
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 수집이 오래 걸리면 CLI(npx tsx src/scripts/crawl.ts)를 쓰세요.");
    } finally {
      setBusyId(null);
    }
  }

  /** n47 출처 등록 */
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusyId("NEW");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "등록에 실패했습니다.");
        return;
      }
      setForm({ name: "", listPath: "", boardNo: "", category: "DEPT" });
      setShowForm(false);
      setMessage("출처를 등록했습니다. 수집을 실행해 공지를 가져오세요.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => crawl()}
          disabled={busyId !== null}
          className={buttonStyles.primary}
        >
          {busyId === "ALL" ? "수집 중… (수십 초 소요)" : "활성 출처 전체 수집"}
        </button>
        <button type="button" onClick={() => setShowForm((v) => !v)} className={buttonStyles.secondary}>
          출처 등록
        </button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}

      {outcomes && outcomes.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">수집 결과</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {outcomes.map((o) => (
              <li key={o.sourceName}>
                <span className={o.status === "FAILED" ? "text-danger" : ""}>{o.status}</span> ·{" "}
                {o.sourceName} — 조회 {o.fetched} / 신규 {o.created} / 갱신 {o.updated}
                {o.errorMessage ? <span className="text-warning"> · {o.errorMessage}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={create} className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">새 출처 등록</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted">출처 이름</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="예: 신소재공학부 학부공지"
                required
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">게시판 경로</span>
              <input
                value={form.listPath}
                onChange={(event) => setForm({ ...form, listPath: event.target.value })}
                placeholder="/mse/board/notice.do"
                required
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">boardNo (선택)</span>
              <input
                value={form.boardNo}
                onChange={(event) => setForm({ ...form, boardNo: event.target.value })}
                placeholder="게시판 페이지 소스의 boardNo"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">분류</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={`mt-1 ${inputClass}`}
              >
                {SOURCE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            경로는 https://www.yu.ac.kr 다음 부분입니다. 예: yu.ac.kr/mse/board/notice.do → /mse/board/notice.do
          </p>
          <div className="mt-3">
            <button type="submit" disabled={busyId === "NEW"} className={buttonStyles.primary}>
              {busyId === "NEW" ? "등록 중…" : "등록"}
            </button>
          </div>
        </form>
      ) : null}

      {/* n46 등록된 출처 목록 */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">출처</th>
              <th className="px-4 py-2.5 font-medium">분류</th>
              <th className="px-4 py-2.5 font-medium">공지</th>
              <th className="px-4 py-2.5 font-medium">최근 수집</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">동작</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map((source) => (
              <tr key={source.id} className={source.isActive ? "" : "opacity-55"}>
                <td className="px-4 py-3">
                  <p className="font-medium">{source.name}</p>
                  <a
                    href={`https://www.yu.ac.kr${source.listPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent underline break-all"
                  >
                    {source.listPath}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={source.category}
                    disabled={busyId === source.id}
                    onChange={(event) => patch(source.id, { category: event.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  >
                    {SOURCE_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{source.noticeCount.toLocaleString("ko-KR")}건</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {source.lastCrawledAt ? formatDate(source.lastCrawledAt, true) : "—"}
                </td>
                <td className="px-4 py-3">
                  {source.isActive ? <Badge tone="success">활성</Badge> : <Badge>비활성</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {/* n48 출처 활성화·비활성화 */}
                    <button
                      type="button"
                      disabled={busyId === source.id}
                      onClick={() => patch(source.id, { isActive: !source.isActive })}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted disabled:opacity-60"
                    >
                      {source.isActive ? "비활성화" : "활성화"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null || !source.isActive}
                      onClick={() => crawl(source.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-muted disabled:opacity-60"
                    >
                      {busyId === source.id ? "수집 중…" : "수집"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        분류는 추천 가중치에 쓰입니다. 현재 분류 종류:{" "}
        {SOURCE_CATEGORIES.map((c) => sourceCategoryLabel(c.key)).join(", ")}
      </p>
    </div>
  );
}

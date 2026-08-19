import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { Badge, Card, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/session";

/** n50 수집 상태 모니터링 / n51 수집 이력 및 오류 목록 */
export default async function AdminCrawlsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [runs, perSource] = await Promise.all([
    prisma.crawlRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 60,
      include: { source: { select: { name: true } } },
    }),
    prisma.source.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastCrawledAt: true,
        _count: { select: { notices: true } },
      },
    }),
  ]);

  const failed = runs.filter((r) => r.status === "FAILED");
  const partial = runs.filter((r) => r.status === "PARTIAL");

  const tone = (status: string) =>
    status === "SUCCESS" ? "success" : status === "FAILED" ? "danger" : status === "PARTIAL" ? "warning" : "neutral";

  return (
    <AdminShell>
      <SectionTitle title="수집 상태" description="최근 60건의 수집 이력입니다." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">실패</p>
          <p className={`mt-1 text-2xl font-bold ${failed.length > 0 ? "text-danger" : ""}`}>
            {failed.length}
          </p>
          <p className="mt-0.5 text-xs text-muted">목록 요청 자체가 실패한 경우</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">부분 성공</p>
          <p className={`mt-1 text-2xl font-bold ${partial.length > 0 ? "text-warning" : ""}`}>
            {partial.length}
          </p>
          <p className="mt-0.5 text-xs text-muted">목록은 됐지만 일부 상세 실패</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">전체 이력</p>
          <p className="mt-1 text-2xl font-bold">{runs.length}</p>
          <p className="mt-0.5 text-xs text-muted">표시된 최근 실행 수</p>
        </Card>
      </div>

      <h2 className="mt-6 mb-2 text-base font-bold">출처별 마지막 수집</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">출처</th>
              <th className="px-4 py-2.5 font-medium">누적 공지</th>
              <th className="px-4 py-2.5 font-medium">마지막 수집</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {perSource.map((source) => (
              <tr key={source.id} className={source.isActive ? "" : "opacity-55"}>
                <td className="px-4 py-2.5">{source.name}</td>
                <td className="px-4 py-2.5">{source._count.notices.toLocaleString("ko-KR")}건</td>
                <td className="px-4 py-2.5 text-muted">
                  {source.lastCrawledAt ? formatDate(source.lastCrawledAt, true) : "수집 이력 없음"}
                </td>
                <td className="px-4 py-2.5">
                  {source.isActive ? <Badge tone="success">활성</Badge> : <Badge>비활성</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 mb-2 text-base font-bold">수집 이력 및 오류</h2>
      {runs.length === 0 ? (
        <EmptyState
          title="수집 이력이 없습니다."
          description="출처 관리 화면에서 수동 수집을 실행하거나 npx tsx src/scripts/crawl.ts 를 쓰세요."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">시각</th>
                <th className="px-4 py-2.5 font-medium">출처</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
                <th className="px-4 py-2.5 font-medium">조회</th>
                <th className="px-4 py-2.5 font-medium">신규</th>
                <th className="px-4 py-2.5 font-medium">갱신</th>
                <th className="px-4 py-2.5 font-medium">실행</th>
                <th className="px-4 py-2.5 font-medium">오류</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                    {formatDate(run.startedAt, true)}
                  </td>
                  <td className="px-4 py-2.5">{run.source.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={tone(run.status)}>{run.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">{run.fetched}</td>
                  <td className="px-4 py-2.5">{run.created}</td>
                  <td className="px-4 py-2.5">{run.updated}</td>
                  <td className="px-4 py-2.5 text-muted">{run.trigger}</td>
                  <td className="px-4 py-2.5 max-w-xs text-warning">{run.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

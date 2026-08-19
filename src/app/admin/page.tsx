import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { Card, formatDate } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { isAiEnabled } from "@/lib/ai/client";

/** n44 관리자 대시보드 */
export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [
    sourceCount,
    activeSources,
    noticeCount,
    hiddenCount,
    pendingEnrichment,
    pendingDuplicates,
    feedbackCount,
    userCount,
    lastRun,
    failedRuns,
  ] = await Promise.all([
    prisma.source.count(),
    prisma.source.count({ where: { isActive: true } }),
    prisma.notice.count(),
    prisma.notice.count({ where: { isHidden: true } }),
    prisma.notice.count({ where: { enrichedAt: null } }),
    prisma.duplicateCandidate.count({ where: { status: "PENDING" } }),
    prisma.feedback.count(),
    prisma.user.count(),
    prisma.crawlRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { source: { select: { name: true } } },
    }),
    prisma.crawlRun.count({ where: { status: "FAILED" } }),
  ]);

  const tiles = [
    { label: "등록 출처", value: `${activeSources} / ${sourceCount}`, hint: "활성 / 전체", href: "/admin/sources" },
    { label: "수집 공지", value: noticeCount.toLocaleString("ko-KR"), hint: `숨김 ${hiddenCount}건`, href: "/admin/notices" },
    { label: "중복 검토 대기", value: pendingDuplicates, hint: "확인이 필요한 후보", href: "/admin/duplicates" },
    { label: "피드백", value: feedbackCount, hint: "학생 의견", href: "/admin/feedback" },
    { label: "요약 대기", value: pendingEnrichment, hint: isAiEnabled() ? "AI 요약 대기" : "AI 키 미설정", href: "/admin/notices" },
    { label: "가입 학생", value: userCount, hint: "학번 기준", href: "/admin" },
  ];

  return (
    <AdminShell>
      <h1 className="text-xl font-bold">운영 현황</h1>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="block">
            <Card className="h-full transition-colors hover:border-accent">
              <p className="text-xs text-muted">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold">{tile.value}</p>
              <p className="mt-0.5 text-xs text-muted">{tile.hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="text-sm font-medium">최근 수집</p>
          {lastRun ? (
            <div className="mt-2 space-y-1 text-sm text-muted">
              <p>
                {lastRun.source.name} · <span className="font-medium text-foreground">{lastRun.status}</span>
              </p>
              <p>
                {formatDate(lastRun.startedAt, true)} · 조회 {lastRun.fetched} / 신규 {lastRun.created} / 갱신{" "}
                {lastRun.updated}
              </p>
              {lastRun.errorMessage ? <p className="text-warning">{lastRun.errorMessage}</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">아직 수집 기록이 없습니다.</p>
          )}
          <Link href="/admin/crawls" className="mt-3 inline-block text-sm text-accent">
            수집 이력 보기 →
          </Link>
        </Card>

        <Card>
          <p className="text-sm font-medium">점검이 필요한 항목</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {failedRuns > 0 ? (
              <li className="text-danger">수집 실패 이력 {failedRuns}건 — 출처 경로를 확인하세요.</li>
            ) : null}
            {pendingDuplicates > 0 ? (
              <li className="text-warning">중복 후보 {pendingDuplicates}건이 검토를 기다립니다.</li>
            ) : null}
            {!isAiEnabled() ? (
              <li className="text-muted">
                ANTHROPIC_API_KEY가 없어 AI 요약이 꺼져 있습니다. 마감일·대상학년은 규칙 기반으로
                추출되고 있습니다.
              </li>
            ) : pendingEnrichment > 0 ? (
              <li className="text-muted">요약 대기 {pendingEnrichment}건 — enrich 스크립트를 실행하세요.</li>
            ) : null}
            {failedRuns === 0 && pendingDuplicates === 0 && isAiEnabled() && pendingEnrichment === 0 ? (
              <li className="text-success">특별히 점검할 항목이 없습니다.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}

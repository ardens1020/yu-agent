import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { Badge, Card, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { FEEDBACK_KINDS, feedbackKindLabel } from "@/lib/taxonomy";

/** n57 피드백 신고 조회 화면 / n58 추천·요약 피드백 목록 */
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const params = await searchParams;
  const kindParam = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind = kindParam && FEEDBACK_KINDS.some((f) => f.key === kindParam) ? kindParam : "";

  const [rows, byKind, topNotices] = await Promise.all([
    prisma.feedback.findMany({
      where: kind ? { kind } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        notice: { select: { id: true, title: true, source: { select: { name: true } } } },
        user: { select: { studentId: true, grade: true, academicStatus: true } },
      },
    }),
    prisma.feedback.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.feedback.groupBy({
      by: ["noticeId"],
      _count: { _all: true },
      orderBy: { _count: { noticeId: "desc" } },
      take: 5,
    }),
  ]);

  const topTitles = await prisma.notice.findMany({
    where: { id: { in: topNotices.map((t) => t.noticeId) } },
    select: { id: true, title: true },
  });
  const titleById = new Map(topTitles.map((n) => [n.id, n.title]));

  const total = byKind.reduce((sum, k) => sum + k._count._all, 0);
  const tone = (key: string) =>
    key === "RECOMMEND_GOOD" ? "success" : key === "RECOMMEND_BAD" ? "warning" : "danger";

  return (
    <AdminShell>
      <SectionTitle
        title="피드백 조회"
        description="학생이 공지 상세에서 남긴 추천·요약 관련 의견입니다."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEEDBACK_KINDS.map((item) => {
          const count = byKind.find((k) => k.kind === item.key)?._count._all ?? 0;
          return (
            <Card key={item.key}>
              <p className="text-xs text-muted">{item.label}</p>
              <p className="mt-1 text-2xl font-bold">{count}</p>
            </Card>
          );
        })}
      </div>

      {topNotices.length > 0 ? (
        <Card className="mt-4">
          <p className="text-sm font-medium">피드백이 많은 공지</p>
          <ul className="mt-2 space-y-1 text-sm">
            {topNotices.map((item) => (
              <li key={item.noticeId} className="flex items-baseline justify-between gap-3">
                <Link href={`/notices/${item.noticeId}`} className="text-accent hover:underline">
                  {titleById.get(item.noticeId)?.slice(0, 60) ?? item.noticeId}
                </Link>
                <span className="shrink-0 text-muted">{item._count._all}건</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-5 mb-3 flex flex-wrap gap-1.5 text-sm">
        <a
          href="/admin/feedback"
          className={`rounded-lg border px-3 py-1.5 ${
            !kind
              ? "border-accent bg-accent-soft font-medium text-accent"
              : "border-border bg-surface hover:bg-surface-muted"
          }`}
        >
          전체 {total}
        </a>
        {FEEDBACK_KINDS.map((item) => (
          <a
            key={item.key}
            href={`/admin/feedback?kind=${item.key}`}
            className={`rounded-lg border px-3 py-1.5 ${
              kind === item.key
                ? "border-accent bg-accent-soft font-medium text-accent"
                : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="피드백이 없습니다."
          description="학생이 공지 상세 화면에서 의견을 남기면 여기에 표시됩니다."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">시각</th>
                <th className="px-4 py-2.5 font-medium">종류</th>
                <th className="px-4 py-2.5 font-medium">공지</th>
                <th className="px-4 py-2.5 font-medium">학생</th>
                <th className="px-4 py-2.5 font-medium">내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                    {formatDate(row.createdAt, true)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={tone(row.kind)}>{feedbackKindLabel(row.kind)}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/notices/${row.notice.id}`} className="text-accent hover:underline">
                      {row.notice.title.slice(0, 46)}
                    </Link>
                    <span className="block text-xs text-muted">{row.notice.source.name}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                    {row.user.studentId}
                    {row.user.grade ? ` · ${row.user.grade}학년` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{row.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

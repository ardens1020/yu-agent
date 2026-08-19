import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState, SectionTitle } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { DuplicateReviewer } from "./DuplicateReviewer";

/** n52 중복 공지 검토 화면 / n53 중복 후보 공지 목록 */
export default async function AdminDuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const params = await searchParams;
  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = statusParam ?? "PENDING";

  const candidates = await prisma.duplicateCandidate.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const noticeIds = candidates.flatMap((c) => [c.noticeAId, c.noticeBId]);
  const notices = await prisma.notice.findMany({
    where: { id: { in: noticeIds } },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      originUrl: true,
      isHidden: true,
      views: true,
      source: { select: { name: true } },
    },
  });
  const byId = new Map(notices.map((n) => [n.id, n]));

  const items = candidates
    .map((candidate) => {
      const a = byId.get(candidate.noticeAId);
      const b = byId.get(candidate.noticeBId);
      if (!a || !b) return null;
      return {
        id: candidate.id,
        score: candidate.score,
        status: candidate.status,
        a: {
          id: a.id,
          title: a.title,
          sourceName: a.source.name,
          publishedAt: a.publishedAt.toISOString(),
          originUrl: a.originUrl,
          isHidden: a.isHidden,
          views: a.views,
        },
        b: {
          id: b.id,
          title: b.title,
          sourceName: b.source.name,
          publishedAt: b.publishedAt.toISOString(),
          originUrl: b.originUrl,
          isHidden: b.isHidden,
          views: b.views,
        },
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const counts = await prisma.duplicateCandidate.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return (
    <AdminShell>
      <SectionTitle
        title="중복 공지 검토"
        description="서로 다른 게시판에 같은 공지가 올라온 경우를 찾아 보여줍니다. 통합하면 한쪽을 숨겨 학생 목록에 하나만 남습니다."
      />

      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {[
          { key: "PENDING", label: "검토 대기" },
          { key: "MERGED", label: "통합됨" },
          { key: "DISTINCT", label: "다른 공지" },
          { key: "ALL", label: "전체" },
        ].map((tab) => {
          const count =
            tab.key === "ALL"
              ? counts.reduce((sum, c) => sum + c._count._all, 0)
              : (counts.find((c) => c.status === tab.key)?._count._all ?? 0);
          return (
            <a
              key={tab.key}
              href={`/admin/duplicates?status=${tab.key}`}
              className={`rounded-lg border px-3 py-1.5 ${
                status === tab.key
                  ? "border-accent bg-accent-soft font-medium text-accent"
                  : "border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              {tab.label} {count}
            </a>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="표시할 중복 후보가 없습니다."
          description="수집을 실행하면 최근 60일 공지에서 제목이 유사한 쌍을 자동으로 찾습니다."
        />
      ) : (
        <DuplicateReviewer items={items} />
      )}
    </AdminShell>
  );
}

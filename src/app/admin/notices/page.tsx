import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState, SectionTitle } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { NoticeEditor } from "./NoticeEditor";

/**
 * n54 공지 오류·수정 화면 / n55 오류·누락 공지 목록 / n56 숨김·수정 처리.
 *
 * 기본 탭은 "점검 필요" — 본문이 비었거나 첨부·요약이 없어 학생에게 정보가 부족한 공지다.
 */
export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const tab = single("tab") || "ISSUES";
  const q = single("q");

  const issueWhere = {
    OR: [
      // 본문도 첨부도 없어 학생이 아무 정보를 얻을 수 없는 공지
      { AND: [{ OR: [{ contentText: null }, { contentText: "" }] }, { attachments: "[]" }] },
      // 상세 수집 자체가 실패한 공지
      { contentText: null },
    ],
  };

  const where =
    tab === "HIDDEN"
      ? { isHidden: true }
      : tab === "REPORTED"
        ? { feedbacks: { some: { kind: { in: ["SUMMARY_WRONG", "CONTENT_ERROR"] } } } }
        : tab === "SEARCH"
          ? q
            ? { OR: [{ title: { contains: q } }, { contentText: { contains: q } }] }
            : {}
          : issueWhere;

  const [rows, counts] = await Promise.all([
    prisma.notice.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        originUrl: true,
        contentText: true,
        attachments: true,
        summary: true,
        isHidden: true,
        adminNote: true,
        enrichedAt: true,
        source: { select: { name: true } },
        _count: { select: { feedbacks: true } },
      },
    }),
    Promise.all([
      prisma.notice.count({ where: issueWhere }),
      prisma.notice.count({ where: { isHidden: true } }),
      prisma.notice.count({
        where: { feedbacks: { some: { kind: { in: ["SUMMARY_WRONG", "CONTENT_ERROR"] } } } },
      }),
    ]),
  ]);

  const [issueCount, hiddenCount, reportedCount] = counts;

  return (
    <AdminShell>
      <SectionTitle
        title="공지 오류·수정"
        description="본문이 비었거나 학생이 오류를 신고한 공지를 확인하고, 숨기거나 제목·요약을 고칠 수 있습니다."
      />

      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {[
          { key: "ISSUES", label: `점검 필요 ${issueCount}` },
          { key: "REPORTED", label: `오류 신고 ${reportedCount}` },
          { key: "HIDDEN", label: `숨김 ${hiddenCount}` },
          { key: "SEARCH", label: "검색" },
        ].map((item) => (
          <a
            key={item.key}
            href={`/admin/notices?tab=${item.key}`}
            className={`rounded-lg border px-3 py-1.5 ${
              tab === item.key
                ? "border-accent bg-accent-soft font-medium text-accent"
                : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      {tab === "SEARCH" ? (
        <form action="/admin/notices" className="mb-4 flex gap-2">
          <input type="hidden" name="tab" value="SEARCH" />
          <input
            name="q"
            defaultValue={q}
            placeholder="제목·본문 검색"
            className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white dark:text-[#0e0f12]"
          >
            검색
          </button>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "ISSUES" ? "점검이 필요한 공지가 없습니다." : "해당하는 공지가 없습니다."}
          description={
            tab === "ISSUES"
              ? "본문과 첨부가 모두 없는 공지, 상세 수집이 실패한 공지가 여기에 표시됩니다."
              : undefined
          }
        />
      ) : (
        <NoticeEditor
          items={rows.map((row) => ({
            id: row.id,
            title: row.title,
            sourceName: row.source.name,
            publishedAt: row.publishedAt.toISOString(),
            originUrl: row.originUrl,
            bodyLength: row.contentText?.length ?? -1,
            attachmentCount: (JSON.parse(row.attachments) as unknown[]).length,
            summary: row.summary,
            isHidden: row.isHidden,
            adminNote: row.adminNote,
            enriched: row.enrichedAt !== null,
            feedbackCount: row._count.feedbacks,
          }))}
        />
      )}
    </AdminShell>
  );
}

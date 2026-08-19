import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { SectionTitle } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { SourceManager } from "./SourceManager";

/** n45 공지 출처 관리 화면 (n46 목록, n47 등록·수정, n48 활성 토글, n49 수동 수집) */
export default async function AdminSourcesPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const sources = await prisma.source.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { notices: true } } },
  });

  return (
    <AdminShell>
      <SectionTitle
        title="공지 출처 관리"
        description="영남대 게시판은 모두 같은 CMS를 쓰므로 게시판 경로만 등록하면 같은 파서로 수집됩니다."
      />
      <SourceManager
        initialSources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          listPath: s.listPath,
          siteId: s.siteId,
          boardNo: s.boardNo,
          category: s.category,
          isActive: s.isActive,
          noticeCount: s._count.notices,
          lastCrawledAt: s.lastCrawledAt?.toISOString() ?? null,
        }))}
      />
    </AdminShell>
  );
}

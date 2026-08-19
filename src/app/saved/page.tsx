import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { NoticeCard } from "@/components/NoticeCard";
import { SaveButton } from "@/components/SaveButton";
import { EmptyState, LinkButton, SectionTitle, formatDate } from "@/components/ui";
import { prisma } from "@/lib/db";
import { toNoticeView, type RawNotice } from "@/lib/notice-mapper";
import { getSessionUser } from "@/lib/session";

/** n28 저장 공지 목록 화면 (n29 목록, n30 저장 취소) */
export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const rows = await prisma.savedNotice.findMany({
    where: { userId: user.id, notice: { isHidden: false } },
    orderBy: { createdAt: "desc" },
    include: {
      notice: {
        select: {
          id: true,
          title: true,
          writer: true,
          publishedAt: true,
          views: true,
          contentText: true,
          originUrl: true,
          attachments: true,
          aiTags: true,
          targetGrades: true,
          deadlineAt: true,
          actionRequired: true,
          summary: true,
          isPinned: true,
          sourceId: true,
          source: { select: { id: true, name: true, category: true } },
        },
      },
    },
  });

  return (
    <AppShell>
      <SectionTitle
        title="저장한 공지"
        description={`${rows.length}건 · 마감이 있는 공지는 먼저 확인하세요`}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="저장한 공지가 없습니다."
          description="공지 상세 화면에서 '저장'을 누르면 여기에 모입니다."
          action={<LinkButton href="/notices" variant="primary">공지 보러 가기</LinkButton>}
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const notice = toNoticeView(row.notice as RawNotice);
            return (
              <li key={row.id} className="space-y-2">
                <NoticeCard notice={notice} saved />
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-xs text-muted">
                    {formatDate(row.createdAt)}에 저장
                  </span>
                  {/* n30 저장 공지 저장 취소 */}
                  <SaveButton noticeId={notice.id} initialSaved onUnsaved />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

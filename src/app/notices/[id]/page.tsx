import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { SaveButton } from "@/components/SaveButton";
import { Badge, Card, LinkButton, daysUntil, formatDate } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getNotice } from "@/lib/notices";
import { sanitizeNoticeHtml, toNoticeView, type RawNotice } from "@/lib/notice-mapper";
import { getSessionUser } from "@/lib/session";
import { interestLabel } from "@/lib/taxonomy";
import { scoreNotice } from "@/lib/recommend";
import { noticeToScorable } from "@/lib/notice-mapper";

/** n16 공지 상세 화면 / n17 공지 상세 정보 (n18 원문 링크, n19 저장, n20 피드백) */
export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const row = await getNotice(id);
  if (!row) notFound();

  const notice = toNoticeView(row as RawNotice);
  const bodyHtml = sanitizeNoticeHtml(row.contentHtml);
  const deadlineDays = notice.deadlineAt ? daysUntil(notice.deadlineAt) : null;

  const [saved, related] = await Promise.all([
    prisma.savedNotice.findUnique({
      where: { userId_noticeId: { userId: user.id, noticeId: id } },
      select: { id: true },
    }),
    prisma.notice.findMany({
      where: { sourceId: notice.sourceId, isHidden: false, NOT: { id } },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { id: true, title: true, publishedAt: true },
    }),
  ]);

  // 이 사용자에게 왜 관련 있는지 설명한다 (추천 엔진과 같은 계산).
  const { score, reasons } = scoreNotice(noticeToScorable(row as RawNotice), {
    grade: user.grade,
    academicStatus: user.academicStatus,
    interests: user.interests,
  });

  return (
    <AppShell>
      <article className="space-y-5">
        <div>
          <Link href="/notices" className="text-sm text-muted hover:text-foreground">
            ← 공지 목록
          </Link>
        </div>

        <header>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{notice.sourceName}</Badge>
            {notice.isPinned ? <Badge tone="warning">고정 공지</Badge> : null}
            {deadlineDays !== null ? (
              <Badge tone={deadlineDays < 0 ? "neutral" : deadlineDays <= 7 ? "danger" : "warning"}>
                {deadlineDays < 0 ? "마감 지남" : `마감 D-${deadlineDays}`}
              </Badge>
            ) : null}
            {notice.actionRequired ? <Badge tone="warning">신청·제출 필요</Badge> : null}
          </div>

          <h1 className="text-2xl font-bold leading-snug">{notice.title}</h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{formatDate(notice.publishedAt)}</span>
            {notice.writer ? <span>{notice.writer}</span> : null}
            <span>조회 {notice.views.toLocaleString("ko-KR")}</span>
            {notice.targetGrades.length > 0 ? (
              <span>{notice.targetGrades.join("·")}학년 대상</span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {/* n18 공식 원문 링크 이동 */}
            <LinkButton href={notice.originUrl} variant="primary" external>
              영남대 원문 보기 ↗
            </LinkButton>
            {/* n19 공지 저장 토글 */}
            <SaveButton noticeId={notice.id} initialSaved={Boolean(saved)} />
          </div>
        </header>

        {notice.summary ? (
          <Card className="border-accent/40 bg-accent-soft/40">
            <p className="text-xs font-medium text-accent">AI 요약</p>
            <p className="mt-1.5 leading-relaxed">{notice.summary}</p>
            {notice.aiTags.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {notice.aiTags.map((tag) => (
                  <Badge key={tag}>#{interestLabel(tag)}</Badge>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {reasons.length > 0 ? (
          <Card>
            <p className="text-xs font-medium text-muted">나에게 관련된 이유 (추천 점수 {score})</p>
            <ul className="mt-1.5 space-y-0.5 text-sm">
              {reasons.map((reason) => (
                <li key={reason}>· {reason}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* n17 공지 상세 정보 — 원문 본문 */}
        <Card>
          {bodyHtml ? (
            <div className="notice-body notice-body-scroll" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : (
            <p className="text-sm text-muted">
              이 공지는 본문 없이 첨부파일이나 이미지로만 안내되어 있습니다. 원문에서 확인해 주세요.
            </p>
          )}
        </Card>

        {notice.attachments.length > 0 ? (
          <Card>
            <p className="text-sm font-medium">첨부파일 {notice.attachments.length}건</p>
            <ul className="mt-2 space-y-1.5">
              {notice.attachments.map((file) => (
                <li key={file.url}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent underline break-all"
                  >
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* n20 추천 피드백 선택 */}
        <Card>
          <FeedbackButtons noticeId={notice.id} />
        </Card>

        {related.length > 0 ? (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted">
              같은 게시판의 다른 공지
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {related.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/notices/${item.id}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted"
                  >
                    <span className="text-sm">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(item.publishedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </AppShell>
  );
}

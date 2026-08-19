import Link from "next/link";
import { Badge, daysUntil, relativeDays } from "./ui";
import { interestLabel } from "@/lib/taxonomy";
import type { NoticeView } from "@/lib/notice-mapper";

interface Props {
  notice: NoticeView & { score?: number; reasons?: string[] };
  saved?: boolean;
  /** 추천 이유를 노출할지 (n14 AI 추천 목록에서 사용) */
  showReasons?: boolean;
}

export function NoticeCard({ notice, saved = false, showReasons = false }: Props) {
  const deadlineDays = notice.deadlineAt ? daysUntil(notice.deadlineAt) : null;

  return (
    <Link
      href={`/notices/${notice.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent hover:bg-surface-muted/50"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{notice.sourceName}</Badge>
        {notice.isPinned ? <Badge tone="warning">고정</Badge> : null}
        {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 ? (
          <Badge tone="danger">마감 D-{deadlineDays}</Badge>
        ) : null}
        {notice.actionRequired ? <Badge tone="warning">신청·제출</Badge> : null}
        {saved ? <Badge tone="success">저장됨</Badge> : null}
      </div>

      <h3 className="font-medium leading-snug">{notice.title}</h3>

      {notice.summary || notice.excerpt ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">
          {notice.summary ?? notice.excerpt}
        </p>
      ) : null}

      {showReasons && notice.reasons && notice.reasons.length > 0 ? (
        <p className="mt-2 text-xs text-accent">추천 이유 · {notice.reasons.join(" / ")}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{relativeDays(notice.publishedAt)}</span>
        {notice.writer ? <span>{notice.writer}</span> : null}
        <span>조회 {notice.views.toLocaleString("ko-KR")}</span>
        {notice.attachments.length > 0 ? <span>첨부 {notice.attachments.length}</span> : null}
        {notice.targetGrades.length > 0 ? (
          <span>{notice.targetGrades.join("·")}학년 대상</span>
        ) : null}
        {notice.aiTags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-muted">
            #{interestLabel(tag)}
          </span>
        ))}
      </div>
    </Link>
  );
}

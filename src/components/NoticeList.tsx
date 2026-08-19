import { NoticeCard } from "./NoticeCard";
import { EmptyState } from "./ui";
import type { NoticeView } from "@/lib/notice-mapper";

export function NoticeList({
  notices,
  savedIds,
  showReasons = false,
  emptyTitle = "표시할 공지가 없습니다.",
  emptyDescription,
}: {
  notices: Array<NoticeView & { score?: number; reasons?: string[] }>;
  savedIds?: Set<string>;
  showReasons?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (notices.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="space-y-2.5">
      {notices.map((notice) => (
        <li key={notice.id}>
          <NoticeCard
            notice={notice}
            saved={savedIds?.has(notice.id)}
            showReasons={showReasons}
          />
        </li>
      ))}
    </ul>
  );
}

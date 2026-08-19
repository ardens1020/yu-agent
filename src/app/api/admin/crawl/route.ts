import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { crawlAllActive, crawlSource } from "@/lib/crawler/run";
import { detectDuplicates } from "@/lib/dedupe";
import { fanoutNotifications } from "@/lib/notify";

/** n49 수동 수집 실행 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string; pages?: number };
  const pages = Math.min(10, Math.max(1, Number(body.pages ?? 2) || 2));

  try {
    const outcomes = body.sourceId
      ? [await crawlSource(body.sourceId, { pages })]
      : await crawlAllActive({ pages });

    const createdIds = outcomes.flatMap((o) => o.createdNoticeIds);
    // 수집 후 중복 검토 후보와 알림을 갱신한다.
    const duplicates = createdIds.length > 0 ? await detectDuplicates() : 0;
    const notifications = createdIds.length > 0 ? await fanoutNotifications(createdIds) : 0;

    return NextResponse.json({
      ok: true,
      outcomes: outcomes.map((o) => ({
        sourceName: o.sourceName,
        status: o.status,
        fetched: o.fetched,
        created: o.created,
        updated: o.updated,
        errorMessage: o.errorMessage,
      })),
      duplicates,
      notifications,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

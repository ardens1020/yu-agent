import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** n35 웹 내 알림 목록 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      notice: {
        select: { id: true, title: true, publishedAt: true, source: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({
    unreadCount: rows.filter((r) => !r.isRead).length,
    items: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
      noticeId: r.notice.id,
      title: r.notice.title,
      sourceName: r.notice.source.name,
    })),
  });
}

/** 읽음 처리 — id를 주면 하나만, 없으면 전체 */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  await prisma.notification.updateMany({
    where: { userId: user.id, ...(body.id ? { id: body.id } : {}), isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}

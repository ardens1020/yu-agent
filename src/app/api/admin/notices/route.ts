import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

/** n56 공지 숨김·수정 처리 */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    isHidden?: boolean;
    title?: string;
    summary?: string | null;
    adminNote?: string | null;
    /** 요약을 다시 만들도록 enrichedAt을 비운다 */
    clearEnrichment?: boolean;
  };
  if (!body.id) return NextResponse.json({ error: "공지 id가 필요합니다." }, { status: 400 });

  const notice = await prisma.notice.update({
    where: { id: body.id },
    data: {
      ...(body.isHidden !== undefined ? { isHidden: body.isHidden } : {}),
      ...(body.title !== undefined && body.title.trim() ? { title: body.title.trim() } : {}),
      ...(body.summary !== undefined ? { summary: body.summary?.trim() || null } : {}),
      ...(body.adminNote !== undefined ? { adminNote: body.adminNote?.trim() || null } : {}),
      ...(body.clearEnrichment ? { enrichedAt: null, summary: null } : {}),
    },
    select: { id: true, isHidden: true, title: true, summary: true, adminNote: true },
  });
  return NextResponse.json({ ok: true, notice });
}

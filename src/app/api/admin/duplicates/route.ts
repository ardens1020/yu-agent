import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * n53 중복 후보 처리.
 * MERGED = 한쪽을 숨겨 통합 목록에서 하나만 남긴다. DISTINCT = 서로 다른 공지로 확정.
 */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: "MERGED" | "DISTINCT";
    hideNoticeId?: string;
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id와 status가 필요합니다." }, { status: 400 });
  }
  if (body.status !== "MERGED" && body.status !== "DISTINCT") {
    return NextResponse.json({ error: "status는 MERGED 또는 DISTINCT여야 합니다." }, { status: 400 });
  }

  const candidate = await prisma.duplicateCandidate.findUnique({ where: { id: body.id } });
  if (!candidate) {
    return NextResponse.json({ error: "중복 후보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.status === "MERGED") {
    const hideId = body.hideNoticeId ?? candidate.noticeBId;
    if (hideId !== candidate.noticeAId && hideId !== candidate.noticeBId) {
      return NextResponse.json({ error: "숨길 공지가 이 후보에 속하지 않습니다." }, { status: 400 });
    }
    await prisma.notice.update({
      where: { id: hideId },
      data: { isHidden: true, adminNote: "중복 공지로 통합되어 숨김" },
    });
  }

  await prisma.duplicateCandidate.update({
    where: { id: body.id },
    data: { status: body.status },
  });
  return NextResponse.json({ ok: true });
}

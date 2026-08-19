import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { FEEDBACK_KINDS } from "@/lib/taxonomy";

/** n20 추천 피드백 선택 (관리자는 n58에서 조회) */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { kind?: string; comment?: string };
  if (!body.kind || !FEEDBACK_KINDS.some((f) => f.key === body.kind)) {
    return NextResponse.json({ error: "피드백 종류가 올바르지 않습니다." }, { status: 400 });
  }

  const notice = await prisma.notice.findUnique({ where: { id }, select: { id: true } });
  if (!notice) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });

  await prisma.feedback.create({
    data: {
      userId: user.id,
      noticeId: id,
      kind: body.kind,
      comment: body.comment?.trim()?.slice(0, 500) || null,
    },
  });
  return NextResponse.json({ ok: true });
}

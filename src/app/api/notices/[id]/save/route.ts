import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** n19 공지 저장 토글 */
export async function POST(_request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  const notice = await prisma.notice.findFirst({ where: { id, isHidden: false }, select: { id: true } });
  if (!notice) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });

  await prisma.savedNotice.upsert({
    where: { userId_noticeId: { userId: user.id, noticeId: id } },
    create: { userId: user.id, noticeId: id },
    update: {},
  });
  return NextResponse.json({ ok: true, saved: true });
}

/** n30 저장 공지 저장 취소 */
export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  await prisma.savedNotice.deleteMany({ where: { userId: user.id, noticeId: id } });
  return NextResponse.json({ ok: true, saved: false });
}

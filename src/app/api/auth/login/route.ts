import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setStudentSession } from "@/lib/session";

/** n6 로그인 정보 제출 — 데모용으로 학번만 받는다. 없으면 계정을 만든다. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { studentId?: string; name?: string };
  const studentId = body.studentId?.trim();

  if (!studentId || !/^\d{6,12}$/.test(studentId)) {
    return NextResponse.json({ error: "학번은 숫자 6~12자리로 입력해 주세요." }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { studentId },
    create: { studentId, name: body.name?.trim() || null },
    update: body.name?.trim() ? { name: body.name.trim() } : {},
    select: { id: true, onboardedAt: true },
  });

  await setStudentSession(user.id);

  // n7 프로필 설정 여부에 따라 온보딩 또는 공지 목록으로 보낸다.
  return NextResponse.json({ ok: true, needsOnboarding: user.onboardedAt === null });
}

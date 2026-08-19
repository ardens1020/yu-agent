import { NextResponse } from "next/server";
import { prisma, toJson } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { ACADEMIC_STATUSES, INTEREST_MAP } from "@/lib/taxonomy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json({ user });
}

/** n11 프로필 저장 / n39 프로필 수정 저장 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string | null;
    grade?: number | null;
    academicStatus?: string | null;
    interests?: string[];
  };

  const grade = body.grade == null ? null : Number(body.grade);
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 5)) {
    return NextResponse.json({ error: "학년은 1~5 사이로 선택해 주세요." }, { status: 400 });
  }

  const status = body.academicStatus ?? null;
  if (status !== null && !ACADEMIC_STATUSES.some((s) => s.key === status)) {
    return NextResponse.json({ error: "학업 상태 값이 올바르지 않습니다." }, { status: 400 });
  }

  const interests = (body.interests ?? []).filter((key) => key in INTEREST_MAP);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: body.name?.trim() || null,
      grade,
      academicStatus: status,
      interests: toJson(interests),
      onboardedAt: user.onboardedAt ?? new Date(),
    },
    select: { id: true, grade: true, academicStatus: true, interests: true, onboardedAt: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}

/** n40/n41 프로필 초기화 — 학년·상태·관심분야를 비우고 온보딩 상태로 되돌린다. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: null,
        grade: null,
        academicStatus: null,
        interests: toJson([]),
        onboardedAt: null,
      },
    }),
    prisma.alertSetting.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}

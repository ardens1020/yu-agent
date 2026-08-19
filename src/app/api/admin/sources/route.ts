import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { SOURCE_CATEGORIES } from "@/lib/taxonomy";

/** n46 등록된 출처 목록 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sources = await prisma.source.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { notices: true } } },
  });
  return NextResponse.json({ sources });
}

/** n47 출처 등록 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const listPath = body.listPath?.trim();

  if (!listPath?.startsWith("/") || !listPath.endsWith(".do")) {
    return NextResponse.json(
      { error: "게시판 경로는 /로 시작하고 .do로 끝나야 합니다. 예: /che/notice/notice.do" },
      { status: 400 },
    );
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "출처 이름을 입력해 주세요." }, { status: 400 });
  }
  const category = body.category ?? "DEPT";
  if (!SOURCE_CATEGORIES.some((c) => c.key === category)) {
    return NextResponse.json({ error: "분류 값이 올바르지 않습니다." }, { status: 400 });
  }

  const existing = await prisma.source.findUnique({ where: { listPath } });
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 게시판 경로입니다." }, { status: 409 });
  }

  const maxOrder = await prisma.source.aggregate({ _max: { sortOrder: true } });
  const source = await prisma.source.create({
    data: {
      name: body.name.trim(),
      listPath,
      siteId: body.siteId?.trim() || listPath.split("/")[1] || "main",
      boardNo: body.boardNo?.trim() || "",
      category,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ ok: true, source });
}

/** n47 출처 수정 저장 / n48 활성화·비활성화 */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    category?: string;
    isActive?: boolean;
    sortOrder?: number;
  };
  if (!body.id) return NextResponse.json({ error: "출처 id가 필요합니다." }, { status: 400 });

  if (body.category && !SOURCE_CATEGORIES.some((c) => c.key === body.category)) {
    return NextResponse.json({ error: "분류 값이 올바르지 않습니다." }, { status: 400 });
  }

  const source = await prisma.source.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });
  return NextResponse.json({ ok: true, source });
}

/** 잘못 등록한 출처를 지운다. 수집된 공지도 함께 삭제된다(onDelete: Cascade). */
export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "출처 id가 필요합니다." }, { status: 400 });

  const source = await prisma.source.findUnique({
    where: { id },
    include: { _count: { select: { notices: true } } },
  });
  if (!source) return NextResponse.json({ error: "출처를 찾을 수 없습니다." }, { status: 404 });

  await prisma.source.delete({ where: { id } });
  return NextResponse.json({ ok: true, removedNotices: source._count.notices });
}

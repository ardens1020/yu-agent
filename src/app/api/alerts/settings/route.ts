import { NextResponse } from "next/server";
import { prisma, parseJsonArray, toJson } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { INTEREST_MAP } from "@/lib/taxonomy";

/** n32 알림 설정 정보 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const setting = await prisma.alertSetting.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    setting: setting
      ? {
          enabled: setting.enabled,
          keywords: parseJsonArray<string>(setting.keywords),
          interests: parseJsonArray<string>(setting.interests),
          sourceIds: parseJsonArray<string>(setting.sourceIds),
          minScore: setting.minScore,
        }
      : null,
  });
}

/** n33 알림 기준 저장 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    keywords?: string[];
    interests?: string[];
    sourceIds?: string[];
    minScore?: number;
  };

  const keywords = (body.keywords ?? [])
    .map((k) => k.trim())
    .filter((k) => k.length >= 2 && k.length <= 30)
    .slice(0, 20);
  const interests = (body.interests ?? []).filter((key) => key in INTEREST_MAP);
  const sourceIds = (body.sourceIds ?? []).filter((id) => typeof id === "string").slice(0, 20);
  const minScore = Math.min(100, Math.max(0, Number(body.minScore ?? 50) || 0));

  const data = {
    enabled: body.enabled ?? true,
    keywords: toJson(keywords),
    interests: toJson(interests),
    sourceIds: toJson(sourceIds),
    minScore,
  };

  await prisma.alertSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}

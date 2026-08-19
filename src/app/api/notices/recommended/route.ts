import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { recommendNotices } from "@/lib/notices";

/** n14 AI 추천 공지 목록 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const limit = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "8", 10) || 8;
  const items = await recommendNotices(
    { grade: user.grade, academicStatus: user.academicStatus, interests: user.interests },
    { limit: Math.min(30, limit) },
  );
  return NextResponse.json({ items });
}

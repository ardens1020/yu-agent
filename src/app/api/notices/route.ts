import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listNotices } from "@/lib/notices";

/** n13/n23/n25 — 목록·필터·검색 API (화면은 서버 컴포넌트에서 같은 함수를 쓴다) */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const url = new URL(request.url);
  const result = await listNotices({
    q: url.searchParams.get("q") ?? undefined,
    sourceId: url.searchParams.get("source") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    hasAttachment: url.searchParams.get("attach") === "1",
    page: Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
    perPage: Number.parseInt(url.searchParams.get("perPage") ?? "20", 10) || 20,
  });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { isAdmin } from "./session";

/** 관리자 API 공통 가드. 통과하면 null, 아니면 401 응답을 돌려준다. */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

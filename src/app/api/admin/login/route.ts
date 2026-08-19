import { NextResponse } from "next/server";
import { checkAdminPassword, setAdminSession } from "@/lib/session";

/** n43 관리자 로그인 제출 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!body.password || !checkAdminPassword(body.password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await setAdminSession();
  return NextResponse.json({ ok: true });
}

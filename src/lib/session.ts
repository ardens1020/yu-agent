import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

const STUDENT_COOKIE = "yu_session";
const ADMIN_COOKIE = "yu_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

/**
 * 프로덕션에서 시크릿 폴백은 곧 "공개된 비밀번호"다 (저장소가 공개면 더더욱).
 * 조용히 기본값으로 도는 것보다 부팅/요청 시점에 터지는 게 낫다. `db.ts`와 같은 원칙.
 * 빈 문자열 환경변수도 미설정으로 본다 — `??`면 빈 비밀번호가 그대로 통과한다.
 */
function requiredSecret(name: "SESSION_SECRET" | "ADMIN_PASSWORD", devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name}가 설정되지 않았다. 배포 환경변수에 등록하고 재배포하라.`);
  }
  return devFallback;
}

function secret(): string {
  return requiredSecret("SESSION_SECRET", "yu-agent-dev-secret");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** value.signature 형태의 서명 쿠키를 만든다. */
function seal(value: string): string {
  return `${value}.${sign(value)}`;
}

function unseal(sealed: string | undefined): string | null {
  if (!sealed) return null;
  const index = sealed.lastIndexOf(".");
  if (index <= 0) return null;
  const value = sealed.slice(0, index);
  const signature = sealed.slice(index + 1);
  const expected = sign(value);
  if (signature.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return value;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

/* ── 학생 세션 ─────────────────────────────────────────── */

export async function setStudentSession(userId: string): Promise<void> {
  (await cookies()).set(STUDENT_COOKIE, seal(userId), COOKIE_OPTIONS);
}

export async function clearStudentSession(): Promise<void> {
  (await cookies()).delete(STUDENT_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  return unseal((await cookies()).get(STUDENT_COOKIE)?.value);
}

export interface SessionUser {
  id: string;
  studentId: string;
  name: string | null;
  grade: number | null;
  academicStatus: string | null;
  interests: string[];
  onboardedAt: Date | null;
}

/** 세션에서 사용자를 읽는다. 없으면 null (로그인 화면으로 보내는 판단은 호출자가 한다). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      studentId: true,
      name: true,
      grade: true,
      academicStatus: true,
      interests: true,
      onboardedAt: true,
    },
  });
  if (!user) return null;
  let interests: string[] = [];
  try {
    const parsed = JSON.parse(user.interests);
    if (Array.isArray(parsed)) interests = parsed as string[];
  } catch {
    interests = [];
  }
  return { ...user, interests };
}

/* ── 관리자 세션 ───────────────────────────────────────── */

export async function setAdminSession(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, seal("admin"), { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 8 });
}

export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  return unseal((await cookies()).get(ADMIN_COOKIE)?.value) === "admin";
}

export function checkAdminPassword(input: string): boolean {
  const expected = requiredSecret("ADMIN_PASSWORD", "yuadmin");
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
  } catch {
    return false;
  }
}

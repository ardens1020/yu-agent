import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // libSQL 어댑터 하나로 로컬 파일(file:./dev.db)과 Turso(libsql://...)를 모두 처리한다.
  // 빈 문자열도 미설정으로 본다. `??`는 ""를 통과시켜 URL_INVALID로 늦게 터진다.
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
  if (process.env.VERCEL && url.startsWith("file:")) {
    // 서버리스 파일시스템은 휘발성이라 빈 DB가 만들어지고 모든 쿼리가 실패한다. 조용히 깨지느니 여기서 멈춘다.
    throw new Error("TURSO_DATABASE_URL이 비어 있다. Vercel 프로젝트 환경변수를 확인하라.");
  }
  const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

// 지연 생성. 모듈 최상단에서 만들면 `next build`의 라우트 설정 수집 단계에서도 실행돼,
// 빌드 환경에 DB 환경변수가 없으면 빌드 자체가 깨진다.
let client: PrismaClient | undefined;
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    client ??= globalForPrisma.prisma ?? createClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** SQLite에는 JSON 타입이 없어 문자열로 저장한다. 안전하게 파싱한다. */
export function parseJsonArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7은 .env를 자동으로 읽지 않는다. Vercel 빌드에는 .env 파일이 없으므로 없으면 넘어간다.
try {
  process.loadEnvFile?.(path.join(process.cwd(), ".env"));
} catch {
  // 파일 없음 — 플랫폼이 주입한 환경변수를 그대로 쓴다.
}

// git 배포는 .env 없이 클론만 하므로 DATABASE_URL이 비어 있다. 빌드가 쓰는 건
// `prisma generate`뿐이고 여기엔 DB 주소가 필요 없다. 마이그레이션 CLI를 로컬에서
// 돌릴 때만 실제 값이 쓰이므로 기본값을 채워 빌드가 멈추지 않게 한다.
process.env.DATABASE_URL ||= "file:./dev.db";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

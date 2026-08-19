import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7은 .env를 자동으로 읽지 않는다. Vercel 빌드에는 .env 파일이 없으므로 없으면 넘어간다.
try {
  process.loadEnvFile?.(path.join(process.cwd(), ".env"));
} catch {
  // 파일 없음 — 플랫폼이 주입한 환경변수를 그대로 쓴다.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

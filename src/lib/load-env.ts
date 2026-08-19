/** CLI 스크립트용 환경변수 로더. Next.js 런타임에서는 필요 없다. */
import path from "node:path";

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile?.(path.join(process.cwd(), file));
  } catch {
    // 파일이 없으면 무시
  }
}

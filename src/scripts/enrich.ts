/**
 * AI 요약·분류 백필.
 *   npx tsx src/scripts/enrich.ts --limit 5          # 순차 처리 (소량 확인용)
 *   npx tsx src/scripts/enrich.ts --batch            # Batches API 제출 (50% 요금, 초기 시드용)
 *   npx tsx src/scripts/enrich.ts --status <batchId> # 배치 진행 확인
 *   npx tsx src/scripts/enrich.ts --collect <batchId># 배치 결과 반영
 *
 * ANTHROPIC_API_KEY가 없으면 아무것도 하지 않고 안내만 출력한다.
 */
import "../lib/load-env";
import { prisma } from "../lib/db";
import { isAiEnabled } from "../lib/ai/client";
import { enrichPending } from "../lib/ai/enrich";
import { collectEnrichmentBatch, getBatchStatus, submitEnrichmentBatch } from "../lib/ai/batch";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  if (!isAiEnabled()) {
    console.log(
      "ANTHROPIC_API_KEY가 설정되지 않았다.\n" +
        ".env.local에 키를 넣으면 요약·태그·마감일 추출이 켜진다.\n" +
        "키가 없어도 서비스는 동작하며, 화면에는 본문 발췌가 표시된다.",
    );
    const pending = await prisma.notice.count({ where: { enrichedAt: null } });
    console.log(`\n요약 대기 중인 공지: ${pending}건`);
    return;
  }

  const statusId = arg("status");
  if (statusId) {
    const status = await getBatchStatus(statusId);
    console.log(status ? JSON.stringify(status, null, 2) : "배치를 찾을 수 없다.");
    return;
  }

  const collectId = arg("collect");
  if (collectId) {
    const result = await collectEnrichmentBatch(collectId);
    console.log(
      `반영 완료 — 성공 ${result.succeeded} / 요청실패 ${result.failed} / 파싱실패 ${result.parseFailed}`,
    );
    return;
  }

  if (has("batch")) {
    const result = await submitEnrichmentBatch({ limit: Number.parseInt(arg("limit") ?? "300", 10) });
    if (result.requested === 0) {
      console.log("요약할 공지가 없다.");
      return;
    }
    console.log(
      `배치 제출: ${result.requested}건 (batchId=${result.batchId})\n` +
        `진행 확인:  npx tsx src/scripts/enrich.ts --status ${result.batchId}\n` +
        `결과 반영:  npx tsx src/scripts/enrich.ts --collect ${result.batchId}`,
    );
    return;
  }

  const limit = Number.parseInt(arg("limit") ?? "20", 10);
  const result = await enrichPending({ limit });
  console.log(`요약 완료 ${result.processed}건 / 실패 ${result.failed}건`);

  const sample = await prisma.notice.findMany({
    where: { NOT: { enrichedAt: null } },
    orderBy: { enrichedAt: "desc" },
    take: 3,
    select: { title: true, summary: true, aiTags: true, deadlineAt: true, targetGrades: true, actionRequired: true },
  });
  for (const n of sample) {
    console.log(`\n· ${n.title.slice(0, 50)}`);
    console.log(`  요약: ${n.summary}`);
    console.log(
      `  태그=${n.aiTags} 학년=${n.targetGrades} 마감=${n.deadlineAt?.toISOString().slice(0, 10) ?? "-"} 신청필요=${n.actionRequired}`,
    );
  }
}

main().finally(() => prisma.$disconnect());

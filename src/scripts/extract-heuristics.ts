/**
 * 규칙 기반 추출을 기존 공지에 적용한다 (AI 요약이 없을 때의 폴백).
 *   npx tsx src/scripts/extract-heuristics.ts [--dry]
 * AI 요약이 이미 반영된 공지(enrichedAt != null)는 건드리지 않는다.
 */
import "../lib/load-env";
import { prisma, toJson } from "../lib/db";
import { extractHeuristics } from "../lib/extract";

const dry = process.argv.includes("--dry");

async function main() {
  const rows = await prisma.notice.findMany({
    where: { enrichedAt: null },
    select: { id: true, title: true, contentText: true, publishedAt: true },
  });

  let deadlines = 0;
  let grades = 0;
  let actions = 0;
  const samples: string[] = [];

  for (const row of rows) {
    const result = extractHeuristics(row.title, row.contentText, row.publishedAt);
    if (result.deadlineAt) deadlines += 1;
    if (result.targetGrades.length > 0) grades += 1;
    if (result.actionRequired) actions += 1;

    if (samples.length < 12 && (result.deadlineAt || result.targetGrades.length > 0)) {
      samples.push(
        `  ${row.title.slice(0, 44)}\n` +
          `      마감=${result.deadlineAt?.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) ?? "-"}` +
          ` 학년=${result.targetGrades.join("·") || "전체"} 신청필요=${result.actionRequired}` +
          ` (게시 ${row.publishedAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })})`,
      );
    }

    if (!dry) {
      await prisma.notice.update({
        where: { id: row.id },
        data: {
          deadlineAt: result.deadlineAt,
          targetGrades: toJson(result.targetGrades),
          actionRequired: result.actionRequired,
        },
      });
    }
  }

  console.log(`대상 ${rows.length}건${dry ? " (dry run — 저장하지 않음)" : ""}`);
  console.log(`  마감일 추출 ${deadlines}건 | 대상학년 추출 ${grades}건 | 신청필요 ${actions}건`);
  console.log("\n샘플:");
  console.log(samples.join("\n"));
}

main().finally(() => prisma.$disconnect());

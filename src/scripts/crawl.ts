/**
 * 수동 수집: npx tsx src/scripts/crawl.ts [--pages 3] [--source <listPath|이름 일부>]
 * 예) npx tsx src/scripts/crawl.ts --pages 3
 *     npx tsx src/scripts/crawl.ts --source /che/notice/notice.do --pages 1
 */
import "../lib/load-env";
import { prisma } from "../lib/db";
import { crawlSource } from "../lib/crawler/run";
import { detectDuplicates } from "../lib/dedupe";
import { fanoutNotifications } from "../lib/notify";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const pages = Number.parseInt(arg("pages") ?? "3", 10);
  const filter = arg("source");

  const sources = await prisma.source.findMany({
    where: {
      isActive: true,
      ...(filter
        ? { OR: [{ listPath: { contains: filter } }, { name: { contains: filter } }] }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
  });

  if (sources.length === 0) {
    console.log("수집할 활성 출처가 없다. 먼저 seed-sources를 실행하라.");
    return;
  }

  console.log(`출처 ${sources.length}개 × ${pages}페이지 수집 시작\n`);
  const allCreated: string[] = [];

  for (const source of sources) {
    const outcome = await crawlSource(source.id, { pages });
    allCreated.push(...outcome.createdNoticeIds);
    const mark = outcome.status === "SUCCESS" ? "✓" : outcome.status === "PARTIAL" ? "△" : "✗";
    console.log(
      `${mark} ${outcome.sourceName.padEnd(24)} 조회 ${String(outcome.fetched).padStart(3)} | ` +
        `신규 ${String(outcome.created).padStart(3)} | 갱신 ${String(outcome.updated).padStart(3)}` +
        (outcome.errorMessage ? `  → ${outcome.errorMessage}` : ""),
    );
  }

  const totals = await prisma.notice.count();
  console.log(`\n전체 공지 ${totals}건`);

  if (allCreated.length > 0) {
    const dupes = await detectDuplicates();
    const notifications = await fanoutNotifications(allCreated);
    console.log(`중복 후보 ${dupes}건, 알림 ${notifications}건 생성`);
  }
}

main().finally(() => prisma.$disconnect());

/**
 * 특정 출처의 공지를 삭제하고 다시 수집한다 (파서 수정 후 재적재용).
 *   npx tsx src/scripts/recrawl-source.ts --source <listPath 일부> [--pages 3]
 */
import "../lib/load-env";
import { prisma } from "../lib/db";
import { crawlSource } from "../lib/crawler/run";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const filter = arg("source");
  if (!filter) {
    console.log("--source <listPath 또는 이름 일부> 를 지정하라.");
    return;
  }
  const pages = Number.parseInt(arg("pages") ?? "3", 10);
  const sources = await prisma.source.findMany({
    where: { OR: [{ listPath: { contains: filter } }, { name: { contains: filter } }] },
  });

  for (const source of sources) {
    const removed = await prisma.notice.deleteMany({ where: { sourceId: source.id } });
    const outcome = await crawlSource(source.id, { pages });
    console.log(
      `${source.name}: ${removed.count}건 삭제 → 조회 ${outcome.fetched} 신규 ${outcome.created} (${outcome.status})`,
    );
  }
}

main().finally(() => prisma.$disconnect());

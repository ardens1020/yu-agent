/** 출처 등록/갱신: npx tsx src/scripts/seed-sources.ts */
import "../lib/load-env";
import { prisma } from "../lib/db";
import { SOURCE_SEEDS } from "../lib/crawler/sources";

async function main() {
  for (const seed of SOURCE_SEEDS) {
    // deepPages는 크롤러 전용 값이라 Source 테이블에 없다. 넘기면 upsert가 검증에서 막힌다.
    const { deepPages: _deepPages, ...record } = seed;
    const source = await prisma.source.upsert({
      where: { listPath: seed.listPath },
      create: record,
      update: {
        name: seed.name,
        siteId: seed.siteId,
        boardNo: seed.boardNo,
        category: seed.category,
        sortOrder: seed.sortOrder,
      },
    });
    console.log(`✓ ${source.name}  (${source.listPath})`);
  }
  const total = await prisma.source.count();
  console.log(`\n출처 ${total}개 등록됨`);
}

main().finally(() => prisma.$disconnect());

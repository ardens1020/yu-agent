/**
 * 파서 검증 스크립트 (DB 없이 실행).
 *   npx tsx src/scripts/verify-parser.ts
 * 각 출처의 첫 페이지를 파싱해 필드가 제대로 채워지는지 눈으로 확인한다.
 */
import { SOURCE_SEEDS } from "../lib/crawler/sources";
import { getAdapter } from "../lib/crawler/adapters";

async function main() {
  for (const seed of SOURCE_SEEDS) {
    const source = { origin: seed.origin, listPath: seed.listPath, category: seed.category };
    try {
      const adapter = getAdapter(seed.adapter);
      const items = await adapter.fetchList(source, { pages: 1, limit: 10 });
      const withDate = items.filter((i) => i.publishedAt).length;
      const withWriter = items.filter((i) => i.writer).length;
      const withFiles = items.filter((i) => i.attachments.length > 0).length;
      console.log(
        `\n■ ${seed.name} (boardNo=${seed.boardNo}, adapter=${seed.adapter})\n` +
          `  건수 ${items.length} | 날짜 ${withDate} | 작성자 ${withWriter} | 첨부있음 ${withFiles} | 고정 ${items.filter((i) => i.isPinned).length}`,
      );
      for (const item of items.slice(0, 2)) {
        console.log(
          `  - [${item.externalId}] ${item.title.slice(0, 50)}\n` +
            `      작성자=${item.writer ?? "-"} 날짜=${item.publishedAt?.toISOString().slice(0, 10) ?? "-"} 조회=${item.views} 첨부=${item.attachments.length}`,
        );
      }
      if (items[0] && adapter.fetchDetail) {
        const detail = await adapter.fetchDetail(source, items[0].externalId);
        console.log(
          `  상세: 제목=${detail.title ? "OK" : "실패"} 작성자=${detail.writer ?? "-"} ` +
            `날짜=${detail.publishedAt?.toISOString().slice(0, 10) ?? "-"} 조회=${detail.views ?? "-"} ` +
            `본문=${detail.contentText.length}자 첨부=${detail.attachments.length}`,
        );
        console.log(`  본문 앞부분: ${detail.contentText.slice(0, 120).replace(/\n/g, " ⏎ ")}`);
      }
    } catch (error) {
      console.log(`\n■ ${seed.name} — 실패: ${(error as Error).message}`);
    }
  }
}

main();

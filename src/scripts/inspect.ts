/** 수집 결과 점검: npx tsx src/scripts/inspect.ts */
import "../lib/load-env";
import { prisma, parseJsonArray } from "../lib/db";

const kst = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

async function main() {
  const sources = await prisma.source.findMany({ orderBy: { sortOrder: "asc" } });
  console.log("출처별 수집 현황");
  for (const s of sources) {
    const count = await prisma.notice.count({ where: { sourceId: s.id } });
    const withBody = await prisma.notice.count({
      where: { sourceId: s.id, NOT: { contentText: null } },
    });
    const newest = await prisma.notice.findFirst({
      where: { sourceId: s.id },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true, title: true },
    });
    console.log(
      `  ${s.name.padEnd(26)} ${String(count).padStart(3)}건 | 본문있음 ${String(withBody).padStart(3)} | ` +
        `최신 ${newest ? kst(newest.publishedAt) : "-"}`,
    );
  }

  const total = await prisma.notice.count();
  const noBody = await prisma.notice.count({ where: { contentText: null } });
  const withAttach = await prisma.notice.count({ where: { NOT: { attachments: "[]" } } });
  console.log(`\n합계 ${total}건 | 본문 없음 ${noBody} | 첨부 있음 ${withAttach}`);

  console.log("\n샘플 3건 (원문 링크 확인용)");
  const samples = await prisma.notice.findMany({
    take: 3,
    orderBy: { publishedAt: "desc" },
    include: { source: { select: { name: true } } },
  });
  for (const n of samples) {
    const files = parseJsonArray<{ name: string }>(n.attachments);
    console.log(`  · [${n.source.name}] ${n.title.slice(0, 46)}`);
    console.log(`    ${kst(n.publishedAt)} | 조회 ${n.views} | 첨부 ${files.length} | 본문 ${n.contentText?.length ?? 0}자`);
    console.log(`    ${n.originUrl}`);
  }

  const dupes = await prisma.duplicateCandidate.findMany({ take: 5 });
  if (dupes.length > 0) {
    console.log("\n중복 후보");
    for (const d of dupes) {
      const [a, b] = await Promise.all([
        prisma.notice.findUnique({ where: { id: d.noticeAId }, select: { title: true, source: { select: { name: true } } } }),
        prisma.notice.findUnique({ where: { id: d.noticeBId }, select: { title: true, source: { select: { name: true } } } }),
      ]);
      console.log(`  ${d.score} | [${a?.source.name}] ${a?.title.slice(0, 34)}`);
      console.log(`         | [${b?.source.name}] ${b?.title.slice(0, 34)}`);
    }
  }

  const runs = await prisma.crawlRun.findMany({ orderBy: { startedAt: "desc" }, take: 3, include: { source: { select: { name: true } } } });
  console.log("\n최근 수집 이력");
  for (const r of runs) console.log(`  ${r.status} ${r.source.name} 조회${r.fetched} 신규${r.created} ${r.errorMessage ?? ""}`);
}

main().finally(() => prisma.$disconnect());

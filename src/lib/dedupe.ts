import { prisma } from "./db";

/** 제목에서 [공지]·[재게시] 같은 접두 태그와 공백·특수문자를 제거해 비교 기준을 만든다. */
export function normalizeTitle(title: string): string {
  return title
    .replace(/\[[^\]]{0,20}\]/g, " ")
    .replace(/\([^)]{0,20}\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function tokenize(title: string): Set<string> {
  const cleaned = title.replace(/\[[^\]]{0,20}\]/g, " ").replace(/[^\p{L}\p{N}\s]+/gu, " ");
  return new Set(
    cleaned
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

const DUPLICATE_THRESHOLD = 0.75;

/**
 * 최근 공지들 사이에서 중복 후보를 찾는다.
 * 같은 게시판의 재게시는 제외하고, **서로 다른 출처** 쌍만 후보로 올린다.
 */
export async function detectDuplicates({ withinDays = 60 } = {}): Promise<number> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const notices = await prisma.notice.findMany({
    where: { publishedAt: { gte: since }, isHidden: false },
    select: { id: true, title: true, sourceId: true, contentHash: true },
    orderBy: { publishedAt: "desc" },
  });

  const prepared = notices.map((n) => ({
    ...n,
    normalized: normalizeTitle(n.title),
    tokens: tokenize(n.title),
  }));

  const pairs: Array<{ noticeAId: string; noticeBId: string; score: number }> = [];

  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      const a = prepared[i];
      const b = prepared[j];
      if (a.sourceId === b.sourceId) continue;

      let score = 0;
      if (a.contentHash === b.contentHash) score = 1;
      else if (a.normalized && a.normalized === b.normalized) score = 0.95;
      else score = jaccard(a.tokens, b.tokens);

      if (score >= DUPLICATE_THRESHOLD) {
        // id 순으로 정렬해 (A,B)/(B,A) 중복 등록을 막는다.
        const [noticeAId, noticeBId] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
        pairs.push({ noticeAId, noticeBId, score: Number(score.toFixed(3)) });
      }
    }
  }

  if (pairs.length === 0) return 0;

  // SQLite에서는 createMany의 skipDuplicates를 쓸 수 없으므로 기존 쌍을 먼저 걸러낸다.
  const existing = await prisma.duplicateCandidate.findMany({
    where: { noticeAId: { in: pairs.map((p) => p.noticeAId) } },
    select: { noticeAId: true, noticeBId: true },
  });
  const seen = new Set(existing.map((e) => `${e.noticeAId}|${e.noticeBId}`));
  const fresh = pairs.filter((p) => !seen.has(`${p.noticeAId}|${p.noticeBId}`));
  if (fresh.length === 0) return 0;

  const result = await prisma.duplicateCandidate.createMany({ data: fresh });
  return result.count;
}

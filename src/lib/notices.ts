import { prisma } from "./db";
import { toNoticeView, noticeToScorable, type NoticeView, type RawNotice } from "./notice-mapper";
import { rankNotices, type Recommendation, type ScorableUser } from "./recommend";

export interface NoticeQuery {
  q?: string;
  sourceId?: string;
  category?: string;
  from?: string;
  to?: string;
  hasAttachment?: boolean;
  page?: number;
  perPage?: number;
  includeHidden?: boolean;
}

export interface NoticeListResult {
  items: NoticeView[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const NOTICE_SELECT = {
  id: true,
  title: true,
  writer: true,
  publishedAt: true,
  views: true,
  contentText: true,
  originUrl: true,
  attachments: true,
  aiTags: true,
  targetGrades: true,
  deadlineAt: true,
  actionRequired: true,
  summary: true,
  isPinned: true,
  isHidden: true,
  adminNote: true,
  sourceId: true,
  source: { select: { id: true, name: true, category: true } },
} as const;

function buildWhere(query: NoticeQuery) {
  const where: Record<string, unknown> = {};
  if (!query.includeHidden) where.isHidden = false;
  if (query.sourceId) where.sourceId = query.sourceId;
  if (query.category) where.source = { category: query.category };

  const q = query.q?.trim();
  if (q) {
    // SQLite의 contains는 기본적으로 대소문자를 구분하지만 한국어 공지에서는 문제되지 않는다.
    where.OR = [{ title: { contains: q } }, { contentText: { contains: q } }];
  }

  const publishedAt: Record<string, Date> = {};
  if (query.from) {
    const from = new Date(`${query.from}T00:00:00+09:00`);
    if (!Number.isNaN(from.getTime())) publishedAt.gte = from;
  }
  if (query.to) {
    const to = new Date(`${query.to}T23:59:59+09:00`);
    if (!Number.isNaN(to.getTime())) publishedAt.lte = to;
  }
  if (Object.keys(publishedAt).length > 0) where.publishedAt = publishedAt;

  if (query.hasAttachment) where.NOT = { attachments: "[]" };

  return where;
}

/** n13 통합 공지 목록 / n23 필터링된 목록 / n25 검색 결과 */
export async function listNotices(query: NoticeQuery = {}): Promise<NoticeListResult> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(50, Math.max(5, query.perPage ?? 20));
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.notice.count({ where }),
    prisma.notice.findMany({
      where,
      select: NOTICE_SELECT,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    items: rows.map((row) => toNoticeView(row as RawNotice)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** n17 공지 상세 정보 */
export async function getNotice(id: string) {
  return prisma.notice.findFirst({
    where: { id, isHidden: false },
    select: { ...NOTICE_SELECT, contentHtml: true },
  });
}

export interface RecommendedItem extends NoticeView {
  score: number;
  reasons: string[];
}

/**
 * n14 AI 추천 공지 목록.
 * 최근 공지를 후보로 두고 규칙 기반 점수를 매긴다 (설명 가능한 추천 이유 포함).
 */
export async function recommendNotices(
  user: ScorableUser,
  { limit = 8, candidateDays = 180 } = {},
): Promise<RecommendedItem[]> {
  const since = new Date(Date.now() - candidateDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.notice.findMany({
    where: { isHidden: false, publishedAt: { gte: since } },
    select: NOTICE_SELECT,
    orderBy: { publishedAt: "desc" },
    take: 400,
  });

  const scorables = rows.map((row) => ({
    raw: row as RawNotice,
    scorable: noticeToScorable(row as RawNotice),
  }));

  const ranked: Recommendation<(typeof scorables)[number]["scorable"]>[] = rankNotices(
    scorables.map((s) => s.scorable),
    user,
    { limit, minScore: 20 },
  );

  const byId = new Map(scorables.map((s) => [s.raw.id, s.raw]));
  return ranked
    .map((r) => {
      const raw = byId.get(r.notice.id);
      if (!raw) return null;
      return { ...toNoticeView(raw), score: r.score, reasons: r.reasons };
    })
    .filter((v): v is RecommendedItem => v !== null);
}

export async function listSources(includeInactive = false) {
  return prisma.source.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, category: true, isActive: true, listPath: true },
  });
}

/** 저장 여부를 한 번에 조회한다 (목록에서 저장 배지를 표시하기 위해) */
export async function getSavedIds(userId: string, noticeIds: string[]): Promise<Set<string>> {
  if (noticeIds.length === 0) return new Set();
  const rows = await prisma.savedNotice.findMany({
    where: { userId, noticeId: { in: noticeIds } },
    select: { noticeId: true },
  });
  return new Set(rows.map((r) => r.noticeId));
}

import { prisma, toJson } from "@/lib/db";
import { extractHeuristics } from "@/lib/extract";
import { contentHash, getAdapter, type ParsedDetail, type ParsedItem, type SourceRef } from "./adapters";

export interface CrawlOutcome {
  sourceId: string;
  sourceName: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  fetched: number;
  created: number;
  updated: number;
  errorMessage: string | null;
  createdNoticeIds: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CrawlOptions {
  pages?: number;
  limit?: number;
  trigger?: "MANUAL" | "SCHEDULED";
  /** 신규 공지 상세 요청 상한 (요청 폭주 방지) */
  maxDetails?: number;
  /**
   * 상세 요청을 건너뛴다. 깊은 이력 수집(수천 건)에 쓴다 —
   * 주기 분석은 제목·날짜만으로 되므로 목록만 받으면 충분하다.
   * 이때 contentText는 null로 남고, 이후 일반 수집이 예산 안에서 점진적으로 채운다.
   */
  skipDetails?: boolean;
}

/**
 * 출처 하나를 수집한다.
 *
 * 목록만으로 제목·작성자·날짜·조회수·첨부까지 확보되므로,
 * 상세 요청은 **신규 공지의 본문**을 위해서만 보낸다.
 * 목록에 작성자/작성일 컬럼이 없는 게시판은 상세 값으로 채운다.
 * join 출처는 상세가 로그인을 요구해 어댑터가 fetchDetail을 제공하지 않는다.
 */
export async function crawlSource(
  sourceId: string,
  {
    pages = 3,
    limit = 10,
    trigger = "MANUAL",
    maxDetails = 60,
    skipDetails = false,
  }: CrawlOptions = {},
): Promise<CrawlOutcome> {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  const run = await prisma.crawlRun.create({ data: { sourceId, status: "RUNNING", trigger } });

  const adapter = getAdapter(source.adapter);
  const sourceRef: SourceRef = {
    origin: source.origin,
    listPath: source.listPath,
    category: source.category,
  };
  const canFetchDetail = Boolean(adapter.fetchDetail) && !skipDetails;

  let fetched = 0;
  let created = 0;
  let updated = 0;
  let detailFailures = 0;
  const createdNoticeIds: string[] = [];

  try {
    const items = await adapter.fetchList(sourceRef, { pages, limit });
    fetched = items.length;

    const existing = await prisma.notice.findMany({
      where: { sourceId, articleNo: { in: items.map((i) => i.externalId) } },
      select: {
        id: true,
        articleNo: true,
        title: true,
        views: true,
        isPinned: true,
        contentText: true,
        publishedAt: true,
        enrichedAt: true,
        deadlineAt: true,
        deadlineSource: true,
        recruitStatus: true,
      },
    });
    const existingByArticleNo = new Map(existing.map((n) => [n.articleNo, n]));

    let detailBudget = maxDetails;

    for (const item of items) {
      const prior = existingByArticleNo.get(item.externalId);

      if (!prior) {
        let detail: ParsedDetail | null = null;
        if (canFetchDetail && detailBudget > 0) {
          detailBudget -= 1;
          try {
            detail = await adapter.fetchDetail!(sourceRef, item.externalId);
            await sleep(250);
          } catch {
            detailFailures += 1;
          }
        }
        const noticeId = await createNotice(sourceId, item, detail);
        if (noticeId) {
          created += 1;
          createdNoticeIds.push(noticeId);
        }
        continue;
      }

      // 기존 → 변경분만 반영한다. AI 필드(summary/aiTags/...)는 건드리지 않는다.
      const changes: Record<string, unknown> = {};
      if (prior.title !== item.title) changes.title = item.title;
      if (item.views && prior.views !== item.views) changes.views = item.views;
      if (prior.isPinned !== item.isPinned) changes.isPinned = item.isPinned;
      if (item.publishedAt && prior.publishedAt.getTime() !== item.publishedAt.getTime()) {
        changes.publishedAt = item.publishedAt;
      }
      // 모집 상태는 시간이 지나면 바뀐다(모집중 → 접수마감 → 종료).
      if (item.recruitStatus && prior.recruitStatus !== item.recruitStatus) {
        changes.recruitStatus = item.recruitStatus;
      }
      // 구조화 마감일은 항상 신뢰한다(추정값을 덮어써도 좋다).
      if (item.deadlineAt && prior.deadlineAt?.getTime() !== item.deadlineAt.getTime()) {
        changes.deadlineAt = item.deadlineAt;
        changes.deadlineSource = "EXACT";
      }

      // contentText가 null이면 상세 요청 자체를 못 한 것이므로 다시 시도한다.
      // 빈 문자열("")은 상세를 받았지만 본문이 실제로 없는 공지(첨부만 있는 공지)다.
      if (prior.contentText === null && canFetchDetail && detailBudget > 0) {
        detailBudget -= 1;
        try {
          const detail = await adapter.fetchDetail!(sourceRef, item.externalId);
          await sleep(250);
          changes.contentHtml = detail.contentHtml;
          changes.contentText = detail.contentText; // 빈 문자열도 저장해 재시도를 멈춘다
          changes.contentHash = contentHash(item.title, detail.contentText);
          if (detail.attachments.length > 0) changes.attachments = toJson(detail.attachments);
          // 본문이 이제 생겼으니 규칙 기반 추출을 다시 돌린다 (AI 요약 전인 경우만).
          if (prior.enrichedAt === null) {
            const h = extractHeuristics(item.title, detail.contentText, prior.publishedAt);
            // 구조화 마감일이 있으면 추정값으로 덮어쓰지 않는다.
            if (prior.deadlineSource !== "EXACT" && !item.deadlineAt) {
              changes.deadlineAt = h.deadlineAt;
              changes.deadlineSource = h.deadlineAt ? "ESTIMATED" : null;
            }
            changes.targetGrades = toJson(h.targetGrades);
            changes.actionRequired = h.actionRequired;
          }
        } catch {
          detailFailures += 1;
        }
      }

      if (Object.keys(changes).length > 0) {
        await prisma.notice.update({ where: { id: prior.id }, data: changes });
        updated += 1;
      }
    }

    const status = detailFailures > 0 ? "PARTIAL" : "SUCCESS";
    const errorMessage =
      detailFailures > 0 ? `상세 페이지 ${detailFailures}건 수집 실패 (목록은 정상)` : null;

    await prisma.crawlRun.update({
      where: { id: run.id },
      data: { status, fetched, created, updated, errorMessage, finishedAt: new Date() },
    });
    await prisma.source.update({ where: { id: sourceId }, data: { lastCrawledAt: new Date() } });

    return {
      sourceId,
      sourceName: source.name,
      status,
      fetched,
      created,
      updated,
      errorMessage,
      createdNoticeIds,
    };
  } catch (error) {
    const errorMessage = (error as Error).message.slice(0, 500);
    await prisma.crawlRun.update({
      where: { id: run.id },
      data: { status: "FAILED", fetched, created, updated, errorMessage, finishedAt: new Date() },
    });
    return {
      sourceId,
      sourceName: source.name,
      status: "FAILED",
      fetched,
      created,
      updated,
      errorMessage,
      createdNoticeIds,
    };
  }
}

async function createNotice(
  sourceId: string,
  item: ParsedItem,
  detail: ParsedDetail | null,
): Promise<string | null> {
  // 목록에 날짜 컬럼이 없는 게시판은 상세 값으로 채운다. 둘 다 없으면 건너뛴다.
  const publishedAt = item.publishedAt ?? detail?.publishedAt ?? null;
  if (!publishedAt) return null;

  const title = item.title || detail?.title || "(제목 없음)";
  const contentText = detail?.contentText ?? "";
  const attachments = item.attachments.length > 0 ? item.attachments : (detail?.attachments ?? []);

  // 구조화 마감일(join)이 있으면 그것을 쓰고, 없으면 본문에서 추정한다.
  const heuristics = extractHeuristics(title, contentText, publishedAt);
  const deadlineAt = item.deadlineAt ?? heuristics.deadlineAt;
  const deadlineSource = item.deadlineAt ? "EXACT" : heuristics.deadlineAt ? "ESTIMATED" : null;

  const notice = await prisma.notice.create({
    data: {
      sourceId,
      articleNo: item.externalId,
      title,
      writer: item.writer ?? detail?.writer ?? null,
      publishedAt,
      views: item.views || detail?.views || 0,
      contentHtml: detail?.contentHtml ?? null,
      // 상세 요청에 성공했으면 빈 본문이라도 ""로 저장한다(null = 상세 미수집).
      contentText: detail ? detail.contentText : null,
      originUrl: item.originUrl,
      attachments: toJson(attachments),
      isPinned: item.isPinned,
      contentHash: contentHash(title, contentText),
      deadlineAt,
      deadlineSource,
      targetGrades: toJson(heuristics.targetGrades),
      actionRequired: heuristics.actionRequired || Boolean(item.deadlineAt),
      company: item.company ?? null,
      recruitStatus: item.recruitStatus ?? null,
      eventStart: item.eventStart ?? null,
      eventEnd: item.eventEnd ?? null,
      structured: toJson(item.structured ?? {}),
    },
    select: { id: true },
  });
  return notice.id;
}

/** 활성 출처 전체를 순차 수집한다. */
export async function crawlAllActive(options: CrawlOptions = {}): Promise<CrawlOutcome[]> {
  const sources = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const outcomes: CrawlOutcome[] = [];
  for (const source of sources) {
    outcomes.push(await crawlSource(source.id, options));
  }
  return outcomes;
}

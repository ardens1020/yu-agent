import * as cheerio from "cheerio";
import { endOfKstDay, fetchHtml, parseKstDate, sleep, squish, withQuery } from "./http";
import type {
  CrawlAdapter,
  FetchListOptions,
  ParsedItem,
  SourceRef,
  StructuredFields,
} from "./types";

/**
 * 학생성공처(join.yu.ac.kr) 채용 목록 어댑터.
 *
 *   목록  {listPath}&page=N          ← 공개
 *   상세  &act=job.comp.view&idx=N   ← 로그인 필요(168b + "로그인 후 이용")이므로 수집하지 않는다.
 *
 * 상세를 못 받는 대신 목록이 구조화 필드를 준다:
 *   job01/02  기업명 · 모집분야·급여·근무형태 · 모집전공·지원자격 · 접수기한 · 구분
 *   job03     학원명 · 과목/급여수준/근무형태 · 지역 · 접수기간 · 구분
 *
 * 게시일 컬럼이 없다. 목록에는 현재 모집중인 공고만 노출되므로
 * **처음 발견한 시점을 publishedAt으로 쓴다**(upsert이므로 재수집 시 바뀌지 않는다).
 */

type ColumnKey = "company" | "positionField" | "eligibility" | "region" | "deadline" | "status";

const COLUMN_PATTERNS: Array<{ key: ColumnKey; test: (label: string) => boolean }> = [
  { key: "company", test: (l) => l.includes("기업명") || l.includes("학원명") || l.includes("기관") },
  { key: "positionField", test: (l) => l.includes("모집분야") || l.includes("과목") },
  { key: "eligibility", test: (l) => l.includes("모집전공") || l.includes("지원자격") },
  { key: "region", test: (l) => l === "지역" },
  { key: "deadline", test: (l) => l.includes("접수기한") || l.includes("접수기간") || l.includes("마감") },
  { key: "status", test: (l) => l === "구분" || l.includes("상태") },
];

function mapColumns($: cheerio.CheerioAPI, $table: cheerio.Cheerio<never>) {
  const map: Partial<Record<ColumnKey, number>> = {};
  $table.find("thead th").each((index, el) => {
    const label = $(el).text().replace(/\s+/g, "");
    for (const { key, test } of COLUMN_PATTERNS) {
      if (map[key] === undefined && test(label)) {
        map[key] = index;
        return;
      }
    }
  });
  return map;
}

/** "~ 2026-08-20" → Date, "~ 채용시" / "상시" → null */
export function parseApplyDeadline(raw: string): Date | null {
  const text = squish(raw);
  if (!text || /채용시|상시|수시|미정/.test(text)) return null;
  // 범위로 적힌 경우 끝 날짜를 마감으로 본다.
  const dates = [...text.matchAll(/\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/g)]
    .map((m) => parseKstDate(m[0]))
    .filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  return endOfKstDay(dates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b)));
}

export function parseJobList(html: string, source: SourceRef, discoveredAt: Date): ParsedItem[] {
  const $ = cheerio.load(html);
  const $table = $("table.board_list").first() as unknown as cheerio.Cheerio<never>;
  if ($table.length === 0) return [];

  const columns = mapColumns($, $table);
  const items: ParsedItem[] = [];

  $table.find("tbody tr").each((_, row) => {
    const $row = $(row) as unknown as cheerio.Cheerio<never>;
    const $cells = $row.find("> td");
    if ($cells.length < 3) return;

    const href = $row.find('a[href*="act=job.comp.view"]').first().attr("href");
    const externalId = href?.match(/idx=(\d+)/)?.[1];
    if (!externalId) return;

    const cell = (key: ColumnKey): string => {
      const index = columns[key];
      if (index === undefined) return "";
      return squish($cells.eq(index).text());
    };

    const company = cell("company");
    const positionField = cell("positionField");
    // 기업명이 비면 모집분야를 제목으로 쓴다(교내 프로그램형 공고가 그렇다).
    const title = company || positionField;
    if (!title) return;

    const deadlineRaw = cell("deadline");
    const structured: StructuredFields = {};
    if (positionField) structured.positionField = positionField;
    const eligibility = cell("eligibility");
    if (eligibility) structured.eligibility = eligibility;
    const region = cell("region");
    if (region) structured.region = region;
    if (deadlineRaw) structured.applyPeriodRaw = deadlineRaw;

    items.push({
      externalId,
      title: company && positionField && company !== positionField ? `${company} — ${positionField}` : title,
      writer: null,
      // 게시일 컬럼이 없다. 처음 발견한 시점을 쓴다.
      publishedAt: discoveredAt,
      views: 0,
      isPinned: false,
      attachments: [],
      originUrl: withQuery(source.origin, source.listPath, {
        act: "job.comp.view",
        idx: externalId,
      }),
      company: company || null,
      recruitStatus: cell("status") || null,
      deadlineAt: parseApplyDeadline(deadlineRaw),
      structured,
    });
  });

  return items;
}

export const joinJobAdapter: CrawlAdapter = {
  key: "JOIN_JOB",
  pageSize: 20,

  async fetchList(source: SourceRef, options: FetchListOptions = {}): Promise<ParsedItem[]> {
    const { pages = 5, delayMs = 350 } = options;
    const byId = new Map<string, ParsedItem>();
    const discoveredAt = new Date();

    for (let page = 1; page <= pages; page += 1) {
      const html = await fetchHtml(withQuery(source.origin, source.listPath, { page }));
      const items = parseJobList(html, source, discoveredAt);
      let fresh = 0;
      for (const item of items) {
        if (!byId.has(item.externalId)) {
          byId.set(item.externalId, item);
          fresh += 1;
        }
      }
      if (items.length === 0 || fresh === 0) break;
      if (page < pages) await sleep(delayMs);
    }
    return [...byId.values()];
  },

  // 상세는 로그인이 필요해 수집하지 않는다. fetchDetail을 구현하지 않는다.
};

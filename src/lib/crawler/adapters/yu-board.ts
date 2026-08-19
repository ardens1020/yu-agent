import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { fetchHtml, parseKstDate, sleep, squish, withQuery } from "./http";
import type {
  Attachment,
  CrawlAdapter,
  FetchListOptions,
  ParsedDetail,
  ParsedItem,
  SourceRef,
} from "./types";

/**
 * 영남대 `.do` CMS 어댑터.
 *
 * 영남대 전 게시판이 같은 엔진을 쓴다(실측 확인). 한 번도 분석하지 않은 게시판
 * (/mse/master/board.do)에 이 파서를 적용해 즉시 수집에 성공했다.
 *   목록  {listPath}?mode=list&articleLimit=10&article.offset={N}
 *   상세  {listPath}?mode=view&articleNo={articleNo}
 */

/** 게시판마다 컬럼 구성이 다르므로 thead의 라벨로 인덱스를 찾는다(고정 인덱스 금지). */
type ColumnKey = "num" | "title" | "writer" | "date" | "views" | "file" | "category";

const COLUMN_PATTERNS: Array<{ key: ColumnKey; test: (label: string) => boolean }> = [
  { key: "num", test: (l) => l === "번호" },
  { key: "title", test: (l) => l.includes("제목") },
  { key: "writer", test: (l) => l.includes("작성자") || l.includes("등록자") },
  { key: "date", test: (l) => l.includes("작성일") || l.includes("등록일") || l.includes("날짜") },
  { key: "views", test: (l) => l.includes("조회") },
  { key: "file", test: (l) => l.includes("파일") || l.includes("첨부") },
  { key: "category", test: (l) => l.includes("구분") || l.includes("분류") || l.includes("카테고리") },
];

function mapColumns($: cheerio.CheerioAPI, $table: cheerio.Cheerio<never>): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  $table
    .find("thead th")
    .each((index, el) => {
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

function toAbsolute(href: string, origin: string, listPath: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("?")) return `${origin}${listPath}${href}`;
  if (href.startsWith("/")) return `${origin}${href}`;
  return `${origin}${listPath}?${href.replace(/^\?/, "")}`;
}

/** 첨부파일은 데스크톱/모바일 블록에 중복 등장하므로 attachNo로 중복 제거한다. */
function collectAttachments(
  $: cheerio.CheerioAPI,
  $scope: cheerio.Cheerio<never>,
  origin: string,
  listPath: string,
): Attachment[] {
  const seen = new Set<string>();
  const out: Attachment[] = [];
  $scope.find('a[href*="mode=fileDownload"]').each((_, el) => {
    const $a = $(el);
    // 보조 링크(미리보기/유틸)는 건너뛴다. 단 b-file-dwn은 게시판에 따라
    // 파일명을 직접 담고 있으므로(예: 학술·공연·행사) 텍스트 유무로 판단한다.
    if ($a.hasClass("b-file-preview") || $a.hasClass("b-file-util")) return;
    const href = $a.attr("href");
    if (!href) return;
    const attachNo = href.match(/attachNo=(\d+)/)?.[1] ?? href;
    // 파일명은 .hide(스크린리더 전용) 텍스트를 제외한 본문에서 얻는다.
    const visibleText = $a.clone().find(".hide").remove().end().text().replace(/\s+/g, " ").trim();
    const titleName = $a.attr("title")?.replace(/\s*(다운로드|보기|새 창 열림)\s*$/g, "").trim();
    const name = visibleText || titleName;
    if (!name) return; // 이름 없는 보조 링크
    if (seen.has(attachNo)) return;
    seen.add(attachNo);
    out.push({ name, url: toAbsolute(href, origin, listPath) });
  });
  return out;
}

export function parseList(html: string, origin: string, listPath: string): ParsedItem[] {
  const $ = cheerio.load(html);
  const $table = $("table.board-table").first() as unknown as cheerio.Cheerio<never>;
  if ($table.length === 0) return [];

  const columns = mapColumns($, $table);
  const items: ParsedItem[] = [];

  $table.find("tbody tr").each((_, row) => {
    const $row = $(row) as unknown as cheerio.Cheerio<never>;
    const $link = $row.find('a[href*="mode=view"]').first();
    const href = $link.attr("href");
    if (!href) return;
    const articleNo = href.match(/articleNo=(\d+)/)?.[1];
    if (!articleNo) return;

    // 제목 텍스트는 <span> 안에 있거나 <a> 직속이다.
    const $span = $link.find("span").first();
    const title = ($span.length ? $span.text() : $link.text()).replace(/\s+/g, " ").trim();
    if (!title) return;

    const $cells = $row.find("> td");
    const cellText = (key: ColumnKey): string | null => {
      const index = columns[key];
      if (index === undefined) return null;
      const $cell = $cells.eq(index);
      if ($cell.length === 0) return null;
      // 제목 셀에는 모바일 블록이 섞여 있어 그대로 쓰면 오염된다.
      if (key === "title") return null;
      const text = $cell.clone().find(".b-m-con").remove().end().text();
      return text.replace(/\s+/g, " ").trim() || null;
    };

    const $mobile = $row.find(".b-m-con").first();
    const mobileDate = $mobile.find(".b-date").text().replace(/\s+/g, " ").trim() || null;
    const mobileViews = $mobile.find(".hit").text().replace(/[^\d]/g, "") || null;

    const writerRaw = cellText("writer");
    const dateRaw = cellText("date") ?? mobileDate;
    const viewsRaw = cellText("views")?.replace(/[^\d]/g, "") || mobileViews;

    items.push({
      externalId: articleNo,
      title,
      writer: writerRaw && writerRaw.length <= 60 ? writerRaw : null,
      publishedAt: parseKstDate(dateRaw),
      views: viewsRaw ? Number.parseInt(viewsRaw, 10) || 0 : 0,
      isPinned: $row.find("td.b-num-box .b-notice").length > 0,
      attachments: collectAttachments($, $row, origin, listPath),
      originUrl: viewUrl(origin, listPath, articleNo),
    });
  });

  return items;
}

/** HTML 본문을 읽을 수 있는 평문으로 변환한다. */
function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "$&\n");
  const $ = cheerio.load(withBreaks);
  $("script, style").remove();
  return $.root()
    .text()
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseDetail(html: string, origin: string, listPath: string): ParsedDetail {
  const $ = cheerio.load(html);
  const $root = $(".bn-view-common01, .board.view, body").first() as unknown as cheerio.Cheerio<never>;

  const pick = (selector: string): string | null => {
    const text = $root.find(selector).first().text().replace(/\s+/g, " ").trim();
    return text || null;
  };

  const title =
    $root.find(".b-title-box .b-title").first().text().replace(/\s+/g, " ").trim() || null;
  const writer = pick(".b-writer-box span:nth-of-type(2)");

  // 게시판에 따라 .b-date-box가 여러 개다(등록일 + 행사 기간 등).
  // '등록일' 라벨이 붙은 박스를 우선 쓰고, 없으면 첫 번째를 쓴다.
  let dateRaw: string | null = null;
  $root.find(".b-date-box").each((_, el) => {
    if (dateRaw) return;
    const $box = $(el);
    const label = $box.find("span").first().text().replace(/\s+/g, "");
    if (!label.includes("등록일") && !label.includes("작성일")) return;
    dateRaw = $box.find("span").eq(1).text().replace(/\s+/g, " ").trim() || null;
  });
  if (!dateRaw) dateRaw = pick(".b-date-box span:nth-of-type(2)");

  const viewsRaw = pick(".b-hit-box span:nth-of-type(2)")?.replace(/[^\d]/g, "") ?? null;

  const $content = $root.find(".b-content-box .fr-view").first();
  const $contentFallback = $content.length ? $content : $root.find(".b-content-box").first();
  const contentHtml = $contentFallback.html()?.trim() ?? "";

  return {
    title,
    writer,
    publishedAt: parseKstDate(dateRaw),
    views: viewsRaw ? Number.parseInt(viewsRaw, 10) || 0 : null,
    contentHtml,
    contentText: contentHtml ? htmlToText(contentHtml) : "",
    attachments: collectAttachments($, $root, origin, listPath),
  };
}

export function contentHash(title: string, contentText: string): string {
  const normalizedTitle = title.replace(/\s+/g, "").toLowerCase();
  return createHash("sha256")
    .update(`${normalizedTitle}|${contentText.replace(/\s+/g, "").slice(0, 500)}`)
    .digest("hex");
}

function listUrl(origin: string, listPath: string, offset: number, limit: number): string {
  return withQuery(origin, listPath, {
    mode: "list",
    articleLimit: limit,
    "article.offset": offset,
  });
}

function viewUrl(origin: string, listPath: string, articleNo: string): string {
  return withQuery(origin, listPath, { mode: "view", articleNo });
}

export const yuBoardAdapter: CrawlAdapter = {
  key: "YU_BOARD",
  pageSize: 10,

  /** 목록을 pages 페이지만큼 읽어 externalId 기준으로 중복 제거한다. */
  async fetchList(source: SourceRef, options: FetchListOptions = {}): Promise<ParsedItem[]> {
    const { pages = 3, limit = 10, delayMs = 300 } = options;
    const byId = new Map<string, ParsedItem>();

    for (let page = 0; page < pages; page += 1) {
      const html = await fetchHtml(listUrl(source.origin, source.listPath, page * limit, limit));
      const items = parseList(html, source.origin, source.listPath);
      // 고정 공지가 모든 페이지에 반복 노출되므로, 신규가 하나도 없으면 마지막 페이지다.
      let fresh = 0;
      for (const item of items) {
        if (!byId.has(item.externalId)) {
          byId.set(item.externalId, item);
          fresh += 1;
        }
      }
      if (items.length === 0 || fresh === 0) break;
      if (page < pages - 1) await sleep(delayMs);
    }
    return [...byId.values()];
  },

  async fetchDetail(source: SourceRef, externalId: string): Promise<ParsedDetail> {
    const html = await fetchHtml(viewUrl(source.origin, source.listPath, externalId));
    return parseDetail(html, source.origin, source.listPath);
  },
};

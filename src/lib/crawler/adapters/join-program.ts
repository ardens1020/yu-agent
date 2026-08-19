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
 * 학생성공처 진로취업 프로그램 어댑터 (`g_page=program&m_page=program01`).
 *
 * 이 출처가 이번 기능의 핵심 데이터다:
 *  - `programIng=end`에 **종료된 프로그램이 43페이지(약 1,290건)** 남아 있다 → 주기 분석 가능
 *  - 프로그램일자·접수기간이 **정확한 날짜**로 제공된다 → 마감일 추정이 불필요
 *  - 내용이 화공 진로와 직결된다(반도체 아카데미, 배터리아카데미, 미래모빌리티 등)
 *
 * 마크업:
 *   .program_list .program_con
 *     a[href*="act=view.new"] → P_IDX
 *     .pro_btn                → 상태("진행중"/"접수마감"/"종료"/"상시"), .deadline → "D-3"
 *     .pro_title              → 제목
 *     .first_date .period     → "프로그램일자 : A ~ B", "접수기간 : A ~ B"
 *   .top_notice li            → 상단 고정(상시). .con .title a, .date .day
 */

/** "프로그램일자 : 2026-06-23 ~ 2026-08-21" → [시작, 끝] */
function parsePeriod(raw: string): [Date | null, Date | null] {
  const text = squish(raw).replace(/^[^:]*:\s*/, "");
  const dates = [...text.matchAll(/\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/g)]
    .map((m) => parseKstDate(m[0]))
    .filter((d): d is Date => d !== null);
  if (dates.length === 0) return [null, null];
  if (dates.length === 1) return [dates[0], dates[0]];
  return [dates[0], dates[dates.length - 1]];
}

export function parseProgramList(html: string, source: SourceRef): ParsedItem[] {
  const $ = cheerio.load(html);
  const items: ParsedItem[] = [];
  const seen = new Set<string>();

  const push = (item: ParsedItem) => {
    if (seen.has(item.externalId)) return;
    seen.add(item.externalId);
    items.push(item);
  };

  const originUrlFor = (id: string) =>
    withQuery(source.origin, source.listPath, { act: "view.new", P_IDX: id });

  // 상단 고정(상시) 프로그램
  $(".top_notice li").each((_, el) => {
    const $li = $(el);
    const href = $li.find('a[href*="act=view.new"]').first().attr("href");
    const externalId = href?.match(/P_IDX=(\d+)/)?.[1];
    if (!externalId) return;
    const title = squish($li.find(".title").first().text()) || squish($li.find("img").attr("alt"));
    if (!title) return;
    const [start, end] = parsePeriod($li.find(".date .day").first().text());
    push({
      externalId,
      title,
      writer: null,
      publishedAt: start,
      views: 0,
      isPinned: true,
      attachments: [],
      originUrl: originUrlFor(externalId),
      company: null,
      recruitStatus: squish($li.find(".pro_btn").first().text()) || "상시",
      deadlineAt: endOfKstDay(end),
      eventStart: null,
      eventEnd: null,
      structured: {},
    });
  });

  // 일반 목록
  $(".program_list .program_con").each((_, el) => {
    const $con = $(el);
    const href = $con.find('a[href*="act=view.new"]').first().attr("href");
    const externalId = href?.match(/P_IDX=(\d+)/)?.[1];
    if (!externalId) return;

    const title =
      squish($con.find(".pro_title").first().text()) || squish($con.find("img").attr("alt"));
    if (!title) return;

    // "D-3 진행중" / "모집완료 HOT" 에서 D-N·배지를 떼어 상태만 남긴다.
    const $btn = $con.find(".pro_btn").first();
    const status = squish($btn.clone().find(".deadline").remove().end().text())
      .replace(/\b(HOT|NEW|BEST)\b/gi, "")
      .trim();

    let eventStart: Date | null = null;
    let eventEnd: Date | null = null;
    let applyStart: Date | null = null;
    let applyEnd: Date | null = null;
    const structured: StructuredFields = {};

    $con.find(".first_date .period, .period").each((__, p) => {
      const raw = squish($(p).text());
      if (!raw) return;
      const [start, end] = parsePeriod(raw);
      if (raw.includes("프로그램일자")) {
        eventStart = start;
        eventEnd = end;
        structured.eventPeriodRaw = raw;
      } else if (raw.includes("접수기간")) {
        applyStart = start;
        applyEnd = end;
        structured.applyPeriodRaw = raw;
      } else if (raw.includes("모집인원")) {
        structured.capacity = raw.replace(/^[^:]*:\s*/, "");
      }
    });

    // 게시일은 접수 시작일이 가장 가깝다. 없으면 프로그램 시작일을 쓴다.
    const publishedAt = applyStart ?? eventStart;

    push({
      externalId,
      title,
      writer: null,
      publishedAt,
      views: 0,
      isPinned: false,
      attachments: [],
      originUrl: originUrlFor(externalId),
      company: null,
      recruitStatus: status || null,
      deadlineAt: endOfKstDay(applyEnd),
      eventStart,
      eventEnd,
      structured,
    });
  });

  return items;
}

/** 진행중 / 교외 / 종료 세 목록을 모두 읽는다. 종료분이 과거 이력이다. */
const PROGRAM_FILTERS = ["in", "out", "end"] as const;

export const joinProgramAdapter: CrawlAdapter = {
  key: "JOIN_PROGRAM",
  pageSize: 30,

  async fetchList(source: SourceRef, options: FetchListOptions = {}): Promise<ParsedItem[]> {
    const { pages = 5, delayMs = 350 } = options;
    const byId = new Map<string, ParsedItem>();

    for (const filter of PROGRAM_FILTERS) {
      for (let page = 1; page <= pages; page += 1) {
        const html = await fetchHtml(
          withQuery(source.origin, source.listPath, { programIng: filter, page }),
        );
        const items = parseProgramList(html, source);
        let fresh = 0;
        for (const item of items) {
          if (!byId.has(item.externalId)) {
            byId.set(item.externalId, item);
            fresh += 1;
          }
        }
        if (items.length === 0 || fresh === 0) break;
        await sleep(delayMs);
      }
    }
    return [...byId.values()];
  },

  // 상세는 로그인 필요 — 수집하지 않는다.
};

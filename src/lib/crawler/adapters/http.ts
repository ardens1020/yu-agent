const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchHtml(url: string, attempt = 1): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(500 * 2 ** (attempt - 1));
    return fetchHtml(url, attempt + 1);
  }
}

/** listPath에 이미 쿼리스트링이 있을 수 있으므로 ?와 &를 구분해 붙인다 (join 출처). */
export function withQuery(origin: string, listPath: string, params: Record<string, string | number>): string {
  const base = `${origin}${listPath}`;
  const separator = base.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${base}${separator}${query}` : base;
}

/** "2026.08.18" / "2026-08-18 15:24" / "2026년 8월 18일" → KST 기준 Date */
export function parseKstDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?:\s*일)?(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh = "00", mm = "00"] = match;
  const pad = (v: string) => v.padStart(2, "0");
  const date = new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 하루의 끝(23:59:59 KST)으로 맞춘다 — 마감일에 사용 */
export function endOfKstDay(date: Date | null): Date | null {
  if (!date) return null;
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  const end = new Date(`${ymd}T23:59:59+09:00`);
  return Number.isNaN(end.getTime()) ? null : end;
}

export function squish(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").replace(/ /g, " ").trim();
}

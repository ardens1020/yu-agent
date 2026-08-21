/**
 * 규칙 기반 추출 — AI 요약이 없을 때도 마감일·대상학년·신청필요 여부를 채운다.
 * ANTHROPIC_API_KEY 없이도 추천이 제대로 동작하게 하는 폴백이며,
 * AI 요약이 돌면 그 결과가 이 값을 덮어쓴다.
 */

/** "8/29", "8. 29.", "8월 29일" */
const MONTH_DAY = String.raw`(\d{1,2})\s*[./월]\s*(\d{1,2})`;
const WITH_YEAR = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;

/**
 * 마감을 직접 뜻하는 표현. 단독 `~`는 제외한다 —
 * 행사 일시("8월 21일~22일")나 실습 기간에도 쓰여 오탐이 크다.
 */
const DEADLINE_MARKERS =
  /(까지|마감|접수\s*기한|신청\s*기한|제출\s*기한|접수\s*기간|신청\s*기간|모집\s*기간|제출\s*기간|접수:|기한\s*:)/g;

/**
 * 본 공고의 접수 기한을 직접 가리키는 표현. 한 공지에 하위 행사 마감
 * ("1:1 멘토링 모집기간: 3/13")이 섞여 있을 때 본 공고 마감을 고르는 기준이다.
 * 이쪽이 하나라도 있으면 `까지`·`마감` 같은 약한 표현은 무시한다.
 */
const STRONG_MARKER =
  /(접수\s*기한|신청\s*기한|제출\s*기한|접수\s*기간|신청\s*기간|제출\s*기간|접수:|기한\s*:)/;

/** 마감이 아닌 날짜가 등장하는 문맥 — 이 구간은 무시한다. */
const NOT_DEADLINE =
  /(일\s*시|일자\s*:|휴진|배부|개최|공연|상영|진료|실습\s*기간|근무\s*기간|교육\s*기간|파견\s*기간|행사|시상|발표일|면접일|오리엔테이션|응시\s*기[한간]|유효\s*기간|인정\s*기간)/;

/**
 * 마감일을 뽑는다.
 *
 * 마감 표현 주변 구간을 보고, 그 구간에서 **가장 늦은** 날짜를 마감으로 본다
 * ("접수기간 8.13 ~ 8.20까지"에서 시작일 8.13이 아니라 8.20을 잡기 위함).
 * 구간이 여러 개면 그중 가장 이른 마감을 택한다(가장 먼저 닥치는 기한).
 */
export function extractDeadline(text: string, publishedAt: Date): Date | null {
  const flat = text.replace(/\s+/g, " ");
  const pubYear = Number(
    publishedAt.toLocaleString("en-US", { timeZone: "Asia/Seoul", year: "numeric" }),
  );

  const dayBefore = publishedAt.getTime() - 24 * 60 * 60 * 1000;
  const yearAfter = publishedAt.getTime() + 400 * 24 * 60 * 60 * 1000;
  const strong: Date[] = [];
  const weak: Date[] = [];

  for (const match of flat.matchAll(DEADLINE_MARKERS)) {
    const index = match.index ?? 0;
    const end = index + match[0].length;
    // 마감 표현 앞뒤를 모두 본다. "8.20.까지"처럼 날짜가 앞에 오기도 하고
    // "신청기간: 2026. 8. 18.(화) ~ 8. 19.(수)"처럼 뒤에 오기도 한다.
    // 뒤쪽은 "2026.09.01.(화)~09.18.(금)" 같은 범위가 들어갈 만큼 넉넉히 잡는다.
    const before = flat.slice(Math.max(0, index - 50), index);
    const after = flat.slice(end, end + 60);
    // 마감이 아닌 날짜 문맥은 표현 앞쪽으로 판단한다. 뒤쪽까지 보면
    // "신청기간 … 면접일 …"처럼 뒤에 딴 항목이 붙은 정상 케이스를 놓친다.
    if (NOT_DEADLINE.test(before + match[0])) continue;

    const inRange = (d: Date) => d.getTime() >= dayBefore && d.getTime() <= yearAfter;
    const bucket = STRONG_MARKER.test(match[0]) ? strong : weak;

    // 표현 바로 뒤에 날짜가 오는 형태("신청기간: 2026. 8. 18.(화) ~ 8. 19.(수)")를 우선한다.
    const ahead = scanDates(after, pubYear, publishedAt).filter((f) => inRange(f.date));
    if (ahead.length > 0 && ahead[0].start <= 15) {
      // 첫 날짜에서 시작해, 범위 표기로만 이어지는 동안 뒤로 넘어간다.
      // 넓은 창의 최댓값을 쓰면 뒤에 붙은 무관한 항목의 날짜를 집어삼킨다.
      let pick = ahead[0];
      for (let i = 1; i < ahead.length; i += 1) {
        if (!RANGE_GAP.test(after.slice(pick.end, ahead[i].start))) break;
        pick = ahead[i];
      }
      bucket.push(pick.date);
      continue;
    }

    // 그 외에는 "8. 20.까지"처럼 표현 앞의 날짜를 쓴다. 가장 가까운(마지막) 것이 마감이다.
    const behind = scanDates(before, pubYear, publishedAt).filter((f) => inRange(f.date));
    if (behind.length > 0) bucket.push(behind[behind.length - 1].date);
  }

  // 접수·신청 기한이 명시된 게 있으면 그쪽만 본다. 없을 때만 약한 표현으로 넘어간다.
  const picked = strong.length > 0 ? strong : weak;
  if (picked.length === 0) return null;
  // 같은 등급 안에서 여러 기한이 있으면 가장 먼저 닥치는 것을 보여준다.
  return picked.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

/**
 * 제목에서 마감을 뽑는다. 제목은 작성자가 직접 정리한 문구라 본문보다 신뢰도가 높고,
 * `(~3/18)`처럼 마감 낱말 없이 물결표만 쓰는 관행이 흔하다. 본문에서 `~`를 그렇게
 * 다루면 행사 기간과 뒤섞여 오탐이 크지만, 짧은 제목 안에서는 안전하다.
 */
export function extractDeadlineFromTitle(title: string, publishedAt: Date): Date | null {
  const flat = title.replace(/\s+/g, " ");
  if (NOT_DEADLINE.test(flat)) return null;

  const pubYear = Number(
    publishedAt.toLocaleString("en-US", { timeZone: "Asia/Seoul", year: "numeric" }),
  );
  const dayBefore = publishedAt.getTime() - 24 * 60 * 60 * 1000;
  const yearAfter = publishedAt.getTime() + 400 * 24 * 60 * 60 * 1000;

  // "~3/18", "( ~ 08/11 )" — 물결표 뒤에 붙은 날짜만 본다.
  const tilde = /[~∼]\s*(\d{1,2})\s*[./월]\s*(\d{1,2})/g;
  const found: Date[] = [];
  for (const m of flat.matchAll(tilde)) {
    let date = makeKstDate(pubYear, Number(m[1]), Number(m[2]));
    if (date && date.getTime() < publishedAt.getTime() - 30 * 24 * 60 * 60 * 1000) {
      date = makeKstDate(pubYear + 1, Number(m[1]), Number(m[2]));
    }
    if (date && date.getTime() >= dayBefore && date.getTime() <= yearAfter) found.push(date);
  }
  if (found.length === 0) return null;
  return found.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

/**
 * 두 날짜 사이가 "범위 표기"뿐인지 본다 — `~`, `-`, 요일 괄호, 시각, 부터/까지.
 * 다른 낱말이 끼면 별개 항목의 날짜이므로 범위로 잇지 않는다.
 */
// 토큰이 여러 번 나올 수 있다 — "…10.27.(월) 10시 ~ 10.31(금) 17시까지"처럼
// 요일 괄호와 시각이 겹쳐 붙는다. 한 번만 허용하면 범위 끝을 놓친다.
const RANGE_GAP =
  /^(?:[\s\d:.,()~\-–—]|[월화수목금토일]\)|부터|까지|시|분|초|일|정오|자정|오전|오후)*$/;

interface FoundDate {
  date: Date;
  start: number;
  end: number;
}

/** 문자열에서 날짜를 등장 순서대로 뽑는다. 연도가 있는 표기를 우선한다. */
function scanDates(text: string, pubYear: number, publishedAt: Date): FoundDate[] {
  const found: FoundDate[] = [];
  const consumed = new Array<boolean>(text.length).fill(false);

  for (const m of text.matchAll(WITH_YEAR)) {
    const start = m.index ?? 0;
    const date = makeKstDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) found.push({ date, start, end: start + m[0].length });
    for (let i = start; i < start + m[0].length; i += 1) consumed[i] = true;
  }

  for (const m of text.matchAll(new RegExp(MONTH_DAY, "g"))) {
    const start = m.index ?? 0;
    if (consumed[start]) continue;
    let date = makeKstDate(pubYear, Number(m[1]), Number(m[2]));
    // 연도가 없고 게시일보다 한 달 이상 이르면 다음 해로 본다.
    if (date && date.getTime() < publishedAt.getTime() - 30 * 24 * 60 * 60 * 1000) {
      date = makeKstDate(pubYear + 1, Number(m[1]), Number(m[2]));
    }
    if (date) found.push({ date, start, end: start + m[0].length });
  }

  return found.sort((a, b) => a.start - b.start);
}

function makeKstDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59+09:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

const ALL_GRADES = [1, 2, 3, 4, 5];

/**
 * 대상 학년을 뽑는다.
 *
 * 본문에는 교과목 개설 학년("2학년 1학기 개설")처럼 대상과 무관한 학년 표기가 흔하다.
 * 잘못 뽑은 학년은 추천에서 감점으로 작용하므로, **대상·자격을 명시한 문맥**과
 * 제목에서만 추출하고 애매하면 빈 배열(전체 대상)로 둔다.
 */
const ELIGIBILITY_MARKERS =
  /(대상자?|자격|신청자격|지원자격|참가자격|응시자격|모집대상|참여대상|해당자|한함|한정|이상만|재학생|필독)/;

export function extractTargetGrades(text: string, title = ""): number[] {
  const flatTitle = title.replace(/\s+/g, "");
  const flatAll = text.replace(/\s+/g, "");

  if (/전학년|전체학년|모든학년|재학생전체|학부생전체/.test(flatTitle + flatAll)) return [];

  // 제목의 학년 표기는 대상으로 신뢰한다.
  const found = new Set<number>();
  collectGrades(flatTitle, found);

  // 본문은 대상·자격을 말하는 문장에서만 본다.
  for (const sentence of text.split(/[\n.。·]|(?<=다)\s/)) {
    const flat = sentence.replace(/\s+/g, "");
    if (!flat || !ELIGIBILITY_MARKERS.test(flat)) continue;
    // "2학년 1학기", "3학년 2학기 개설" 같은 교육과정 표기는 제외한다.
    if (/([1-5])학년[1-2]학기/.test(flat) || /개설|이수구분|교과목명|시간표/.test(flat)) continue;
    collectGrades(flat, found);
  }

  const grades = [...found].sort((a, b) => a - b);
  // 5개 전부면 사실상 전학년이다.
  return grades.length >= 5 ? [] : grades;
}

function collectGrades(flat: string, found: Set<number>): void {
  for (const m of flat.matchAll(/([1-5])학년이상/g)) {
    for (const g of ALL_GRADES) if (g >= Number(m[1])) found.add(g);
  }
  for (const m of flat.matchAll(/([1-5])학년이하/g)) {
    for (const g of ALL_GRADES) if (g <= Number(m[1])) found.add(g);
  }
  for (const m of flat.matchAll(/([1-5])[~\-–]([1-5])학년/g)) {
    const [lo, hi] = [Number(m[1]), Number(m[2])].sort((a, b) => a - b);
    for (let g = lo; g <= hi; g += 1) found.add(g);
  }
  for (const m of flat.matchAll(/((?:[1-5][,·및/]){0,4}[1-5])학년/g)) {
    // "2학년 1학기" 형태는 교육과정 표기이므로 건너뛴다.
    if (/([1-5])학년[1-2]학기/.test(m[0])) continue;
    for (const digit of m[1].match(/[1-5]/g) ?? []) found.add(Number(digit));
  }
  if (/졸업예정|졸업대상|최종학기/.test(flat)) {
    found.add(4);
    found.add(5);
  }
  if (/신입생/.test(flat)) found.add(1);
}

const ACTION_WORDS = [
  "신청", "제출", "접수", "모집", "등록", "지원", "응시", "참가", "참여",
  "납부", "확인원", "변경원", "신청서", "설문", "예약", "선발",
  // 채용 공고는 지원 마감이 있는 대표적인 신청형 공지인데 누락돼 있었다.
  "채용", "공채", "공고",
];

/** 학생이 직접 뭔가 해야 하는 공지인지 판단한다. */
export function extractActionRequired(title: string, body: string): boolean {
  if (ACTION_WORDS.some((word) => title.includes(word))) return true;
  const head = body.slice(0, 600);
  return ACTION_WORDS.filter((word) => head.includes(word)).length >= 2;
}

export interface HeuristicResult {
  deadlineAt: Date | null;
  targetGrades: number[];
  actionRequired: boolean;
}

export function extractHeuristics(
  title: string,
  contentText: string | null,
  publishedAt: Date,
): HeuristicResult {
  const body = contentText ?? "";
  const combined = `${title}\n${body}`;
  const actionRequired = extractActionRequired(title, body);
  return {
    // 신청·제출이 필요 없는 단순 안내(예: 학위복 배부일 안내)에 마감일을 붙이면
    // 거짓 정보가 되므로, 신청형 공지에서만 마감일을 추출한다.
    // 제목에 명시된 마감을 본문보다 우선한다 — 본문엔 하위 행사 기한이 섞여 있다.
    deadlineAt: actionRequired
      ? (extractDeadlineFromTitle(title, publishedAt) ?? extractDeadline(combined, publishedAt))
      : null,
    targetGrades: extractTargetGrades(body, title),
    actionRequired,
  };
}

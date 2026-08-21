/**
 * 마감일 추출 자체 점검: npx tsx src/lib/extract.test.ts
 * 실제 공지에서 잡았던 오탐·누락을 그대로 케이스로 남긴다. 규칙을 손볼 때 여기가 먼저 깨진다.
 */
import assert from "node:assert";
import { extractDeadline, extractDeadlineFromTitle, extractHeuristics } from "./extract";

const pub = (iso: string) => new Date(`${iso}T09:00:00+09:00`);
const day = (d: Date | null) =>
  d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) : null;

const cases: Array<[string, string | null]> = [
  // 날짜가 마감 표현 뒤에 오는 형태 — 창이 4글자였을 때 전부 놓쳤다.
  ["신청기간 : 2026. 8.27.(목) 10:00 ~ 8.31.(월) 16:00", "2026-08-31"],
  ["1. 신청기간: 2026. 8. 18.(화) ~ 8. 19.(수) 10:00 ~ 16:00", "2026-08-19"],
  ["집중 신청기간 1단계 2026.09.01.(화)~09.18.(금) - 4대사회보험", "2026-09-18"],
  // 요일 괄호와 시각이 겹쳐 붙는 범위 — 토큰을 한 번만 허용하면 시작일을 골랐다.
  ["2) 신청기간: 2026.10.27.(화) 10시 ~ 10.31(토) 17시까지", "2026-10-31"],
  // 날짜가 표현 앞에 오는 형태
  ["원서는 2026. 9. 5.까지 제출", "2026-09-05"],
  // 접수 기한이 있으면 하위 행사의 "모집기간/마감"에 밀리지 않아야 한다.
  [
    "1:1 직무멘토링 -모집기간: 9/13(목) 선착순 마감 [접수기간] 2026년 8월 28일 (금) ~ 2026년 9월 18일(화) 23:59시까지",
    "2026-09-18",
  ],
  // 응시 자격 기간은 마감이 아니다 — 제출기한 쪽을 골라야 한다.
  // (자격 기간의 끝 09-10이 제출기한보다 이르므로, 제외되지 않으면 그쪽이 잡힌다.)
  [
    "4) 토익 인정 응시기한: 2024.09.01~2026.09.10 내에 응시한 시험 2. 제출기한: 2026. 09. 27.(일) 17시까지",
    "2026-09-27",
  ],
  // 마감이 아닌 문맥의 날짜는 무시한다.
  ["행사 일시: 2026. 9. 10.까지 진행", null],
  ["실습 기간 2026. 9. 1. ~ 2026. 12. 20.까지", null],
  ["면접일 2026. 9. 9.까지 개별 통보", null],
];

for (const [text, expected] of cases) {
  const actual = day(extractDeadline(text, pub("2026-08-01")));
  assert.strictEqual(actual, expected, `본문 추출 불일치\n  입력: ${text}\n  기대: ${expected}  실제: ${actual}`);
}

// 제목의 물결표 표기는 마감 낱말이 없어도 마감으로 본다 (제목은 작성자가 정리한 문구).
const titleCases: Array<[string, string | null]> = [
  ["[포스코] 2026년 상반기 기술연구원 채용(~9/24)", "2026-09-24"],
  ["(~09/11) 한국생명공학연구원 실습생 모집", "2026-09-11"],
  ["2026 한화에너지 채용전제형 인턴 채용 (~ 9월23일 15:00)", "2026-09-23"],
  ["일반 공지 제목 (마감 표기 없음)", null],
  // 행사 기간 표기는 마감이 아니다.
  ["학술 행사 일시 9/10 ~ 9/12 안내", null],
];
for (const [title, expected] of titleCases) {
  const actual = day(extractDeadlineFromTitle(title, pub("2026-08-01")));
  assert.strictEqual(actual, expected, `제목 추출 불일치\n  입력: ${title}\n  기대: ${expected}  실제: ${actual}`);
}

// 채용 공고는 신청형으로 잡혀야 마감이 붙는다 (ACTION_WORDS 누락으로 빠졌던 케이스).
assert.strictEqual(
  day(extractHeuristics("[포스코] 2026년 상반기 기술연구원 채용(~9/24)", "", pub("2026-08-01")).deadlineAt),
  "2026-09-24",
  "채용 공고에 마감이 붙지 않았다",
);

// 신청이 필요 없는 단순 안내에는 마감을 붙이지 않는다.
assert.strictEqual(
  extractHeuristics("2026학년도 예비군훈련장 변경", "훈련장이 변경되었습니다.", pub("2026-08-01")).deadlineAt,
  null,
  "단순 안내에 마감이 붙었다",
);

// 제목 마감이 본문보다 우선한다.
assert.strictEqual(
  day(
    extractHeuristics(
      "삼양그룹 수시채용 모집 (~9/18)",
      "1:1 멘토링 -모집기간: 9/13(목) 선착순 마감",
      pub("2026-08-01"),
    ).deadlineAt,
  ),
  "2026-09-18",
  "제목 마감이 본문에 밀렸다",
);

console.log(`✓ 마감일 추출 ${cases.length + titleCases.length + 4}개 케이스 통과`);

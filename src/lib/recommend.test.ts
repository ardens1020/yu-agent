/**
 * 추천 정렬 자체 점검: npx tsx src/lib/recommend.test.ts
 */
import assert from "node:assert";
import { rankNotices, type ScorableNotice, type ScorableUser } from "./recommend";

const now = new Date("2026-09-01T12:00:00+09:00");
const day = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

const user: ScorableUser = {
  grade: 3,
  academicStatus: "ENROLLED",
  interests: ["CAREER", "SCHOLARSHIP", "ACADEMIC", "INTERNSHIP"],
};

const make = (id: string, deadlineAt: Date | null, publishedAt = day(-3)): ScorableNotice => ({
  id,
  title: `${id} 장학금 신청 안내`,
  contentText: "신청 접수 안내입니다. 장학 관련 공지입니다.",
  publishedAt,
  deadlineAt,
  targetGrades: [3],
  aiTags: ["SCHOLARSHIP"],
  actionRequired: true,
  sourceCategory: "SCHOLARSHIP",
});

const notices = [
  make("없음A", null),
  make("D30", day(30)),
  make("지남", day(-5)),
  make("D2", day(2)),
  make("없음B", null, day(-1)),
  make("D10", day(10)),
];

const ids = rankNotices(notices, user, { limit: 10, minScore: 0, now, sortBy: "deadline" }).map(
  (r) => r.notice.id,
);

// 남은 마감이 임박한 순 → 마감 없음 → 지난 마감
assert.deepStrictEqual(
  ids.slice(0, 3),
  ["D2", "D10", "D30"],
  `임박 순 정렬이 아니다: ${ids.join(", ")}`,
);
assert.strictEqual(ids[ids.length - 1], "지남", `지난 마감이 마지막이 아니다: ${ids.join(", ")}`);
assert.ok(
  ids.indexOf("없음A") > ids.indexOf("D30") && ids.indexOf("없음A") < ids.indexOf("지남"),
  `마감 없는 공지의 위치가 잘못됐다: ${ids.join(", ")}`,
);

// limit은 정렬 뒤에 잘려야 한다 — 점수가 높지만 마감이 먼 공지에 밀리면 안 된다.
const top2 = rankNotices(notices, user, { limit: 2, minScore: 0, now, sortBy: "deadline" }).map(
  (r) => r.notice.id,
);
assert.deepStrictEqual(top2, ["D2", "D10"], `limit이 정렬보다 먼저 적용됐다: ${top2.join(", ")}`);

// 기존 점수 정렬은 그대로 동작해야 한다 (기본값).
const byScore = rankNotices(notices, user, { limit: 10, minScore: 0, now }).map((r) => r.notice.id);
assert.strictEqual(byScore.length, ids.length, "점수 정렬에서 건수가 달라졌다");
assert.notDeepStrictEqual(byScore, ids, "점수 정렬과 마감 정렬이 같다 — 옵션이 안 먹었다");

console.log("✓ 추천 정렬 4개 케이스 통과");

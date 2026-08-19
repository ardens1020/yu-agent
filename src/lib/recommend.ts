import { INTEREST_MAP, interestLabel, type InterestKey } from "./taxonomy";

/** 추천 계산에 필요한 최소 필드만 받는다 (Prisma 모델에 직접 의존하지 않음). */
export interface ScorableNotice {
  id: string;
  title: string;
  contentText: string | null;
  publishedAt: Date;
  deadlineAt: Date | null;
  targetGrades: number[];
  aiTags: string[];
  actionRequired: boolean;
  sourceCategory: string;
}

export interface ScorableUser {
  grade: number | null;
  academicStatus: string | null;
  interests: string[];
}

export interface ScoreResult {
  score: number;
  reasons: string[];
  matchedInterests: string[];
}

/** 출처별 가중치 — 화공 공지가 학교 전체 공지보다 관련성이 높다. */
const SOURCE_WEIGHT: Record<string, number> = {
  DEPT: 14,
  SCHOLARSHIP: 12,
  INTERNSHIP: 12,
  CAREER: 11,
  GRAD: 10,
  EVENT: 2,
  UNIV: 0,
};

/** 학업 상태별로 특히 중요한 관심 분야 */
const STATUS_PRIORITY: Record<string, InterestKey[]> = {
  ENROLLED: ["ACADEMIC", "SCHOLARSHIP", "STUDENT_LIFE"],
  LEAVE: ["ACADEMIC", "ADMIN"],
  GRADUATING: ["CAREER", "INTERNSHIP", "CERTIFICATE"],
  GRAD_STUDENT: ["GRAD_RESEARCH", "SCHOLARSHIP"],
};

const DAY_MS = 24 * 60 * 60 * 1000;

function countKeywordHits(haystack: string, keywords: string[]): string[] {
  const hits: string[] = [];
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) hits.push(keyword);
  }
  return hits;
}

export function scoreNotice(
  notice: ScorableNotice,
  user: ScorableUser,
  now: Date = new Date(),
): ScoreResult {
  const reasons: string[] = [];
  const matchedInterests: string[] = [];
  let score = 0;

  const title = notice.title;
  const body = (notice.contentText ?? "").slice(0, 3000);

  // 1) 관심 분야 매칭 — 제목 3점 / 본문 1점, 합계 최대 40점
  let interestScore = 0;
  for (const key of user.interests) {
    const interest = INTEREST_MAP[key];
    if (!interest) continue;
    const titleHits = countKeywordHits(title, interest.keywords);
    const bodyHits = countKeywordHits(body, interest.keywords);
    const aiTagHit = notice.aiTags.includes(key);

    let local = titleHits.length * 3 + Math.min(bodyHits.length, 4);
    if (aiTagHit) local += 6;
    if (local > 0) {
      interestScore += local;
      matchedInterests.push(key);
    }
  }
  if (interestScore > 0) {
    score += Math.min(interestScore, 40);
    reasons.push(`관심 분야 ${matchedInterests.map(interestLabel).join("·")}`);
  }

  // 2) 학년 매칭
  if (user.grade && notice.targetGrades.length > 0) {
    if (notice.targetGrades.includes(user.grade)) {
      score += 25;
      reasons.push(`${user.grade}학년 대상`);
    } else {
      score -= 15; // 다른 학년 전용이면 낮춘다
    }
  } else if (notice.targetGrades.length === 0) {
    score += 8;
  }

  // 3) 학업 상태 매칭
  const priorities = STATUS_PRIORITY[user.academicStatus ?? ""] ?? [];
  const statusHit = priorities.find(
    (key) => matchedInterests.includes(key) || notice.aiTags.includes(key),
  );
  if (statusHit) {
    score += 15;
    reasons.push(`${interestLabel(statusHit)} — 현재 학업 상태에 중요`);
  }

  // 4) 최신성
  const ageDays = (now.getTime() - notice.publishedAt.getTime()) / DAY_MS;
  if (ageDays <= 7) {
    score += 20;
    reasons.push("최근 1주 이내 게시");
  } else if (ageDays <= 30) {
    score += 10;
  } else if (ageDays > 365) {
    score -= 10;
  }

  // 5) 마감 임박 / 마감 경과
  if (notice.deadlineAt) {
    const daysLeft = (notice.deadlineAt.getTime() - now.getTime()) / DAY_MS;
    if (daysLeft < 0) {
      score -= 30;
    } else if (daysLeft <= 7) {
      score += 15;
      reasons.push(`마감 D-${Math.max(0, Math.ceil(daysLeft))}`);
    }
  }

  // 6) 학생이 직접 신청·제출해야 하는 공지
  if (notice.actionRequired) {
    score += 10;
    reasons.push("신청·제출 필요");
  }

  // 7) 출처 가중치
  score += SOURCE_WEIGHT[notice.sourceCategory] ?? 0;

  return { score: Math.max(0, Math.round(score)), reasons, matchedInterests };
}

export interface Recommendation<T extends ScorableNotice> extends ScoreResult {
  notice: T;
}

/** 재게시·복수 게시판 노출로 제목이 사실상 같은 공지는 추천에서 하나만 보여준다. */
function dedupeKey(title: string): string {
  return title
    .replace(/\[[^\]]{0,24}\]/g, " ")
    .replace(/\([^)]{0,24}\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

export function rankNotices<T extends ScorableNotice>(
  notices: T[],
  user: ScorableUser,
  { limit = 10, minScore = 20, now = new Date() } = {},
): Recommendation<T>[] {
  const ranked = notices
    .map((notice) => ({ notice, ...scoreNotice(notice, user, now) }))
    .filter((r) => r.score >= minScore)
    .sort(
      (a, b) => b.score - a.score || b.notice.publishedAt.getTime() - a.notice.publishedAt.getTime(),
    );

  const seen = new Set<string>();
  const out: Recommendation<T>[] = [];
  for (const item of ranked) {
    const key = dedupeKey(item.notice.title);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

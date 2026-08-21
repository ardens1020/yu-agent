import { prisma, parseJsonArray } from "./db";
import { INTEREST_MAP, interestLabel } from "./taxonomy";
import { scoreNotice } from "./recommend";
import { noticeToScorable } from "./notice-mapper";

/** KST 자정 기준 날짜 차이. 마감(23:59:59 KST)이 오늘이면 0, 사흘 뒤면 3. */
function kstDayDiff(deadline: Date, now: Date): number {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const midnight = (d: Date) => new Date(`${key(d)}T00:00:00Z`).getTime();
  return Math.round((midnight(deadline) - midnight(now)) / 86_400_000);
}

// 마감까지 남은 일수 → 알림 종류·문구. 이 세 시점에만 알림을 만든다.
const DEADLINE_STAGES: Record<number, { kind: string; reason: string }> = {
  3: { kind: "DEADLINE_D3", reason: "저장한 공지 마감 D-3" },
  1: { kind: "DEADLINE_D1", reason: "저장한 공지 마감 D-1" },
  0: { kind: "DEADLINE_D0", reason: "저장한 공지 오늘 마감" },
};

/**
 * 저장 공지 중 마감이 D-3·D-1·당일인 것에 알림을 만든다.
 * 별도 스케줄러 없이, 헤더가 미읽음 개수를 셀 때(=사용자가 앱을 쓸 때) 호출한다.
 * 같은 (userId, noticeId, kind)는 unique라 하루에 여러 번 호출돼도 한 번만 생긴다.
 */
export async function ensureDeadlineNotifications(userId: string): Promise<void> {
  const saved = await prisma.savedNotice.findMany({
    where: { userId, notice: { isHidden: false, deadlineAt: { not: null } } },
    select: { noticeId: true, notice: { select: { deadlineAt: true } } },
  });
  if (saved.length === 0) return;

  const now = new Date();
  const wanted: Array<{ userId: string; noticeId: string; kind: string; reason: string }> = [];
  for (const row of saved) {
    const stage = DEADLINE_STAGES[kstDayDiff(row.notice.deadlineAt!, now)];
    if (stage) wanted.push({ userId, noticeId: row.noticeId, ...stage });
  }
  if (wanted.length === 0) return;

  // SQLite/libSQL은 createMany의 skipDuplicates를 못 쓰므로 기존 알림을 먼저 걸러낸다.
  const existing = await prisma.notification.findMany({
    where: { userId, noticeId: { in: wanted.map((w) => w.noticeId) }, kind: { startsWith: "DEADLINE_" } },
    select: { noticeId: true, kind: true },
  });
  const seen = new Set(existing.map((e) => `${e.noticeId}|${e.kind}`));
  const fresh = wanted.filter((w) => !seen.has(`${w.noticeId}|${w.kind}`));
  if (fresh.length > 0) await prisma.notification.createMany({ data: fresh });
}

/**
 * 새로 수집된 공지를 알림 기준과 매칭해 Notification을 만든다.
 * 유저플로우 n35(웹 내 알림 목록)용 — 이메일/푸시는 범위 밖.
 */
export async function fanoutNotifications(noticeIds: string[]): Promise<number> {
  if (noticeIds.length === 0) return 0;

  const notices = await prisma.notice.findMany({
    where: { id: { in: noticeIds }, isHidden: false },
    include: { source: { select: { id: true, category: true, name: true } } },
  });
  if (notices.length === 0) return 0;

  const settings = await prisma.alertSetting.findMany({
    where: { enabled: true },
    include: {
      user: { select: { id: true, grade: true, academicStatus: true, interests: true } },
    },
  });
  if (settings.length === 0) return 0;

  const rows: Array<{ userId: string; noticeId: string; reason: string }> = [];

  for (const setting of settings) {
    const keywords = parseJsonArray<string>(setting.keywords);
    const interests = parseJsonArray<string>(setting.interests);
    const sourceIds = parseJsonArray<string>(setting.sourceIds);
    const user = {
      grade: setting.user.grade,
      academicStatus: setting.user.academicStatus,
      interests: parseJsonArray<string>(setting.user.interests),
    };

    for (const notice of notices) {
      if (sourceIds.length > 0 && !sourceIds.includes(notice.sourceId)) continue;

      const reasons: string[] = [];
      const haystack = `${notice.title}\n${notice.contentText ?? ""}`;
      const aiTags = parseJsonArray<string>(notice.aiTags);

      const keywordHit = keywords.find((k) => k.trim() && haystack.includes(k.trim()));
      if (keywordHit) reasons.push(`키워드 "${keywordHit}"`);

      for (const key of interests) {
        const interest = INTEREST_MAP[key];
        if (!interest) continue;
        if (
          aiTags.includes(key) ||
          interest.keywords.some((kw) => notice.title.includes(kw))
        ) {
          reasons.push(`관심 분야 ${interestLabel(key)}`);
          break;
        }
      }

      // 키워드/관심분야 조건이 하나도 설정돼 있지 않으면 추천 점수로 판단한다.
      if (keywords.length === 0 && interests.length === 0) {
        const { score } = scoreNotice(noticeToScorable(notice), user);
        if (score >= setting.minScore) reasons.push(`추천 점수 ${score}점`);
      }

      if (reasons.length > 0) {
        rows.push({
          userId: setting.userId,
          noticeId: notice.id,
          reason: reasons.slice(0, 2).join(", "),
        });
      }
    }
  }

  if (rows.length === 0) return 0;

  // SQLite에서는 createMany의 skipDuplicates를 쓸 수 없으므로 기존 알림을 먼저 걸러낸다.
  const existing = await prisma.notification.findMany({
    where: { noticeId: { in: noticeIds } },
    select: { userId: true, noticeId: true },
  });
  const seen = new Set(existing.map((e) => `${e.userId}|${e.noticeId}`));
  const fresh = rows.filter((r) => !seen.has(`${r.userId}|${r.noticeId}`));
  if (fresh.length === 0) return 0;

  const result = await prisma.notification.createMany({ data: fresh });
  return result.count;
}

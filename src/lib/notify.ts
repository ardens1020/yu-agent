import { prisma, parseJsonArray } from "./db";
import { INTEREST_MAP, interestLabel } from "./taxonomy";
import { scoreNotice } from "./recommend";
import { noticeToScorable } from "./notice-mapper";

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

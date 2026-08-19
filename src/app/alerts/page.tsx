import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AlertSettingsForm } from "./AlertSettingsForm";
import { SectionTitle } from "@/components/ui";
import { prisma, parseJsonArray } from "@/lib/db";
import { listSources } from "@/lib/notices";
import { getSessionUser } from "@/lib/session";

/** n31 알림 설정 화면 (n32 설정 정보, n33 기준 저장) */
export default async function AlertsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [setting, sources, notificationCount] = await Promise.all([
    prisma.alertSetting.findUnique({ where: { userId: user.id } }),
    listSources(),
    prisma.notification.count({ where: { userId: user.id } }),
  ]);

  return (
    <AppShell>
      <SectionTitle
        title="알림 설정"
        description="새 공지가 수집될 때 조건에 맞으면 헤더의 알림에 쌓입니다. 이메일이나 푸시는 보내지 않습니다."
      />
      <AlertSettingsForm
        sources={sources}
        userInterests={user.interests}
        notificationCount={notificationCount}
        initial={
          setting
            ? {
                enabled: setting.enabled,
                keywords: parseJsonArray<string>(setting.keywords),
                interests: parseJsonArray<string>(setting.interests),
                sourceIds: parseJsonArray<string>(setting.sourceIds),
                minScore: setting.minScore,
              }
            : {
                enabled: true,
                keywords: [],
                // 처음 설정할 때는 프로필의 관심 분야를 기본값으로 제안한다.
                interests: user.interests,
                sourceIds: [],
                minScore: 50,
              }
        }
      />
    </AppShell>
  );
}

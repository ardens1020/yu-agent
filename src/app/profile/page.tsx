import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfileForm } from "@/components/ProfileForm";
import { ResetProfileButton } from "./ResetProfileButton";
import { Card, SectionTitle } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { academicStatusLabel, interestLabel } from "@/lib/taxonomy";

/** n37 프로필·관심사 화면 (n38 저장된 정보, n39 수정 저장, n40/n41 초기화) */
export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [savedCount, feedbackCount, notificationCount] = await Promise.all([
    prisma.savedNotice.count({ where: { userId: user.id } }),
    prisma.feedback.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id } }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <SectionTitle title="프로필·관심사" description="추천에 쓰이는 정보입니다." />

        {/* n38 저장된 프로필 정보 */}
        <Card>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">학번</dt>
              <dd className="mt-0.5 font-medium">{user.studentId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">이름</dt>
              <dd className="mt-0.5 font-medium">{user.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">학년</dt>
              <dd className="mt-0.5 font-medium">
                {user.grade ? (user.grade === 5 ? "5학년 이상" : `${user.grade}학년`) : "미설정"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">학업 상태</dt>
              <dd className="mt-0.5 font-medium">{academicStatusLabel(user.academicStatus)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">관심 분야</dt>
              <dd className="mt-0.5 font-medium">
                {user.interests.length > 0
                  ? user.interests.map(interestLabel).join(", ")
                  : "미설정"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-sm text-muted">
            <span>저장한 공지 {savedCount}건</span>
            <span>보낸 피드백 {feedbackCount}건</span>
            <span>받은 알림 {notificationCount}건</span>
          </div>
        </Card>

        {/* n39 프로필 수정 저장 */}
        <section>
          <h2 className="mb-3 text-base font-bold">정보 수정</h2>
          <ProfileForm
            initial={{
              name: user.name,
              grade: user.grade,
              academicStatus: user.academicStatus,
              interests: user.interests,
            }}
            submitLabel="수정 내용 저장"
            redirectTo="/notices"
          />
        </section>

        {/* n40 프로필 초기화 실행 → n41 초기화 확인 */}
        <section>
          <h2 className="mb-3 text-base font-bold">프로필 초기화</h2>
          <Card>
            <p className="text-sm text-muted">
              학년·학업 상태·관심 분야와 알림 설정을 모두 지우고 처음 설정 화면으로 돌아갑니다.
              저장한 공지는 그대로 남습니다.
            </p>
            <div className="mt-3">
              <ResetProfileButton />
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

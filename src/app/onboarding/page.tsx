import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Header } from "@/components/Header";
import { ProfileForm } from "@/components/ProfileForm";

/** n8 온보딩 프로필 설정 (n9 학년·학업상태, n10 관심 분야, n11 저장) */
export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-sm font-medium text-accent">프로필 설정</p>
        <h1 className="mt-1 text-2xl font-bold">어떤 공지를 먼저 보여드릴까요?</h1>
        <p className="mt-2 text-sm text-muted">
          학년과 관심 분야를 알려주면 그에 맞춰 공지를 정렬합니다. 나중에 프로필에서 언제든 바꿀 수
          있습니다.
        </p>
        <div className="mt-6">
          <ProfileForm
            initial={{
              name: user.name,
              grade: user.grade,
              academicStatus: user.academicStatus,
              interests: user.interests,
            }}
            submitLabel="저장하고 공지 보기"
            redirectTo="/notices"
          />
        </div>
      </main>
    </>
  );
}

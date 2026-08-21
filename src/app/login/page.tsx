import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Header } from "@/components/Header";
import { LoginForm } from "./LoginForm";

/** n5 로그인 화면 */
export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.onboardedAt ? "/notices" : "/onboarding");

  return (
    <>
      <Header user={null} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← 처음으로
        </Link>
        <h1 className="mt-4 text-2xl font-bold">로그인</h1>
        <p className="mt-2 text-sm text-muted">
          학번을 입력하면 바로 시작합니다. 학교 포털 계정과는 별개이며 비밀번호를 받지 않습니다.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </main>
    </>
  );
}

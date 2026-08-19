import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { AdminLoginForm } from "./AdminLoginForm";

/** n42 관리자 로그인 화면 */
export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="text-2xl font-bold">관리자 로그인</h1>
      <p className="mt-2 text-sm text-muted">
        출처 관리, 수집 모니터링, 중복 검토, 공지 수정, 피드백 조회를 할 수 있습니다.
      </p>
      <div className="mt-6">
        <AdminLoginForm />
      </div>
    </main>
  );
}

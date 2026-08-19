import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui";

/** n3 서비스 랜딩 화면 → n4 로그인 여부 판단 */
export default async function LandingPage() {
  const user = await getSessionUser();
  // n4: 로그인 상태면 온보딩 여부(n7)에 따라 바로 보낸다.
  if (user) redirect(user.onboardedAt ? "/notices" : "/onboarding");

  const [noticeCount, sources] = await Promise.all([
    prisma.notice.count({ where: { isHidden: false } }),
    prisma.source.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    }),
  ]);

  return (
    <>
      <Header user={null} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <section className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-accent">영남대학교 화학공학부</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            흩어진 공지, 한곳에서
            <br />
            나에게 맞는 것부터
          </h1>
          <p className="mt-4 text-muted">
            학부공지·대학원공지·장학·현장실습·취업정보·영대소식을 매번 따로 확인하지 않아도 됩니다.
            학년과 관심 분야를 알려주면 봐야 할 공지를 먼저 보여드립니다.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/login"
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white dark:text-[#0e0f12]"
            >
              학번으로 시작하기
            </Link>
            <Link
              href="/admin/login"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 font-medium hover:bg-surface-muted"
            >
              관리자 로그인
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">
            현재 {sources.length}개 게시판에서 공지 {noticeCount.toLocaleString("ko-KR")}건을 모아두었습니다.
          </p>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          <Card>
            <h2 className="font-bold">통합 목록</h2>
            <p className="mt-1.5 text-sm text-muted">
              게시판을 옮겨 다니지 않고 한 화면에서 모두 확인합니다. 출처·기간·키워드로 걸러볼 수
              있습니다.
            </p>
          </Card>
          <Card>
            <h2 className="font-bold">맞춤 추천</h2>
            <p className="mt-1.5 text-sm text-muted">
              학년·학업상태·관심 분야에 따라 점수를 매겨 정렬합니다. 왜 추천됐는지 이유도 함께
              보여줍니다.
            </p>
          </Card>
          <Card>
            <h2 className="font-bold">요약과 알림</h2>
            <p className="mt-1.5 text-sm text-muted">
              긴 공지는 핵심만 요약하고 마감일을 뽑아냅니다. 관심 키워드에 맞는 새 공지는 알림으로
              받습니다.
            </p>
          </Card>
        </section>

        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-muted">수집 중인 게시판</h2>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((source) => (
              <span
                key={source.name}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted"
              >
                {source.name}
              </span>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted">
        이 서비스는 학생 편의를 위한 비공식 프로젝트이며, 모든 공지의 원문은 영남대학교 공식 게시판에
        있습니다.
      </footer>
    </>
  );
}

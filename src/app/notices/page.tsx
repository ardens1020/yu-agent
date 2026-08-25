import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { FilterPanel } from "@/components/FilterPanel";
import { NoticeList } from "@/components/NoticeList";
import { Pagination } from "@/components/Pagination";
import { EmptyState, LinkButton, SectionTitle } from "@/components/ui";
import { getSavedIds, listNotices, listSources, recommendNotices } from "@/lib/notices";
import { getSessionUser } from "@/lib/session";
import { interestLabel } from "@/lib/taxonomy";

/**
 * n12 통합 공지 목록 화면.
 * n13 통합 목록 + n14 AI 추천 목록 + n21 필터·검색 패널 + n23/n25 결과 + n27 결과 없음.
 */
export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const single = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const query = {
    q: single("q"),
    sourceId: single("source"),
    category: single("category"),
    from: single("from"),
    to: single("to"),
    hasAttachment: single("attach") === "1",
    page: Number.parseInt(single("page") || "1", 10) || 1,
  };
  const isFiltering = Boolean(
    query.q || query.sourceId || query.category || query.from || query.to || query.hasAttachment,
  );

  const [sources, list, recommended] = await Promise.all([
    listSources(),
    listNotices({ ...query, perPage: 20 }),
    // 검색·필터 중에도 추천을 보여준다. 단 후보를 그 조건 안으로 좁혀서
    // "검색 결과 중 나에게 맞는 것"과 "전체 결과"가 나뉘어 보이게 한다.
    recommendNotices(user, { limit: 6, ...(isFiltering ? { filter: query } : {}) }),
  ]);

  const savedIds = await getSavedIds(user.id, [
    ...list.items.map((n) => n.id),
    ...recommended.map((n) => n.id),
  ]);

  function makeHref(page: number): string {
    const next = new URLSearchParams();
    if (query.q) next.set("q", query.q);
    if (query.sourceId) next.set("source", query.sourceId);
    if (query.category) next.set("category", query.category);
    if (query.from) next.set("from", query.from);
    if (query.to) next.set("to", query.to);
    if (query.hasAttachment) next.set("attach", "1");
    if (page > 1) next.set("page", String(page));
    return `/notices${next.size > 0 ? `?${next}` : ""}`;
  }

  const profileIncomplete = user.interests.length === 0 || user.grade === null;

  return (
    <AppShell>
      <div className="space-y-8">
        <Suspense fallback={<div className="h-20 rounded-xl border border-border bg-surface" />}>
          <FilterPanel
            sources={sources}
            initial={{
              q: query.q,
              sourceId: query.sourceId,
              category: query.category,
              from: query.from,
              to: query.to,
              hasAttachment: query.hasAttachment,
            }}
          />
        </Suspense>

        {/* n14 AI 추천 공지 목록 — 검색·필터 중에는 그 결과 안에서 추천한다 */}
        <section>
          <SectionTitle
            title={isFiltering ? "이 중에서 나에게 맞는 공지" : "나에게 맞는 공지"}
            description={
              profileIncomplete
                ? "프로필을 채우면 추천 정확도가 올라갑니다."
                : `${user.grade}학년 · ${user.interests.map(interestLabel).join(", ")} 기준`
            }
            action={<LinkButton href="/profile" variant="ghost">프로필 수정</LinkButton>}
          />
          {profileIncomplete && recommended.length === 0 ? (
            <EmptyState
              title="아직 추천할 기준이 없습니다."
              description="학년과 관심 분야를 선택하면 그에 맞는 공지를 먼저 보여드립니다."
              action={<LinkButton href="/profile" variant="primary">프로필 설정하기</LinkButton>}
            />
          ) : (
            <NoticeList
              notices={recommended}
              savedIds={savedIds}
              showReasons
              emptyTitle={
                isFiltering
                  ? "이 결과 중에 프로필 조건에 맞는 공지는 없습니다."
                  : "조건에 맞는 추천 공지가 없습니다."
              }
              emptyDescription={
                isFiltering
                  ? "아래 전체 결과에서 직접 확인해 보세요."
                  : "관심 분야를 더 추가하거나 아래 통합 목록에서 직접 찾아보세요."
              }
            />
          )}
        </section>

        {/* n13 통합 공지 목록 / n23 필터링 결과 / n25 검색 결과 */}
        <section>
          <SectionTitle
            title={query.q ? `"${query.q}" 전체 검색 결과` : isFiltering ? "전체 필터 결과" : "전체 공지"}
            description={`${list.total.toLocaleString("ko-KR")}건${
              list.totalPages > 1 ? ` · ${list.page}/${list.totalPages}페이지` : ""
            }`}
          />

          {/* n26 검색 결과 있음? → n27 검색 결과 없음 화면 */}
          {list.total === 0 ? (
            <EmptyState
              title={query.q ? `"${query.q}"에 해당하는 공지가 없습니다.` : "조건에 맞는 공지가 없습니다."}
              description="다른 키워드로 검색하거나 필터 조건을 넓혀 보세요. 오래된 공지는 아직 수집되지 않았을 수 있습니다."
              action={<LinkButton href="/notices" variant="primary">조건 초기화</LinkButton>}
            />
          ) : (
            <>
              <NoticeList notices={list.items} savedIds={savedIds} />
              <Pagination page={list.page} totalPages={list.totalPages} makeHref={makeHref} />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

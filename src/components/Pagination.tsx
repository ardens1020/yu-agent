import Link from "next/link";

/** 목록 페이지네이션 — 현재 쿼리를 유지하며 page만 바꾼다. */
export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const window = 2;
  const start = Math.max(1, page - window);
  const end = Math.min(totalPages, page + window);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const linkClass = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted";

  return (
    <nav className="mt-5 flex flex-wrap items-center justify-center gap-1.5" aria-label="페이지 이동">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className={linkClass}>
          이전
        </Link>
      ) : null}

      {start > 1 ? (
        <>
          <Link href={makeHref(1)} className={linkClass}>
            1
          </Link>
          {start > 2 ? <span className="px-1 text-muted">…</span> : null}
        </>
      ) : null}

      {pages.map((value) => (
        <Link
          key={value}
          href={makeHref(value)}
          aria-current={value === page ? "page" : undefined}
          className={
            value === page
              ? "rounded-lg border border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
              : linkClass
          }
        >
          {value}
        </Link>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link href={makeHref(totalPages)} className={linkClass}>
            {totalPages}
          </Link>
        </>
      ) : null}

      {page < totalPages ? (
        <Link href={makeHref(page + 1)} className={linkClass}>
          다음
        </Link>
      ) : null}
    </nav>
  );
}

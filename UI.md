# 화면 스펙 — 화공 공지 모아보기

> `REBUILD.md`가 **무엇이 동작하는가**를 다룬다면 이 문서는 **무엇이 보이는가**를 다룬다.
> 두 문서를 같이 읽어야 원본과 같은 화면이 나온다.
>
> **§2의 9개 파일은 설명을 보고 다시 쓰지 말고 코드블록을 그대로 옮겨라.**
> 화면 전체의 인상(색·간격·모서리·타이포)이 이 파일들에서 결정된다. 페이지는 이것들을 조립할 뿐이다.
> §3부터는 페이지별 조립 순서와 **화면에 그대로 뜨는 문구**다. 문구는 임의로 바꾸지 마라 —
> 원본과 다른 문구는 곧 다른 화면이다.

---

## 1. 기본 규칙

- **Tailwind v4** (`@import "tailwindcss"`). 색은 **반드시 토큰**으로 쓴다: `bg-surface` `text-muted`
  `border-border` `text-accent` `bg-accent-soft` `text-danger` `text-warning` `text-success`.
  hex를 직접 쓰면 다크모드에서 깨진다. 유일한 예외는 accent 배경 위의 글자색
  `text-white dark:text-[#0e0f12]` (accent가 다크에서 밝은 파랑이라 흰 글자가 안 읽힌다).
- **다크모드는 `prefers-color-scheme` 자동.** 토글 UI는 없다.
- **아이콘 라이브러리를 쓰지 않는다.** 화살표·벨은 문자로 처리: `←` `↗` `🔔` `…`.
- 모서리: 카드·폼·패널 `rounded-xl`, 버튼·입력·목록항목 `rounded-lg`, 배지·칩 `rounded-full`.
- 컨테이너 폭과 여백:

  | 화면 | 컨테이너 |
  |---|---|
  | 학생 화면 (AppShell) | `mx-auto w-full max-w-5xl flex-1 px-4 py-6` |
  | 관리자 화면 (AdminShell) | `mx-auto w-full max-w-6xl flex-1 px-4 py-6` |
  | 랜딩 `/` | `max-w-5xl px-4 py-10` (본문 섹션은 `max-w-2xl` 중앙 정렬) |
  | 로그인 `/login` `/admin/login` | `max-w-md px-4 py-12` |
  | 온보딩 `/onboarding` | `max-w-2xl px-4 py-8` |

- 간격: 공지 목록 `space-y-2.5`, 상세 `space-y-5`, 목록 페이지 섹션 사이 `space-y-8`, 폼 `space-y-6`.
- **기본은 서버 컴포넌트.** `"use client"`는 §4 표에 있는 것만. 목록·상세·관리자 조회는 서버에서
  `lib/notices.ts`를 직접 호출하고, fetch로 자기 API를 부르지 않는다.
- 폰트는 `next/font/google`의 `Noto_Sans_KR` (400/500/700). `word-break: keep-all`로 한국어가
  단어 중간에서 끊기지 않게 한다.

---

## 2. 그대로 옮길 파일

### `src/app/globals.css`

토큰 정의 + `@theme inline` 매핑 + 공지 원문 HTML(`.notice-body`) 스타일. 원문 CMS 마크업은
인라인 스타일을 제거한 상태로 들어오므로 표·이미지·링크 스타일을 여기서 다시 준다.

```css
/* src/app/globals.css */
@import "tailwindcss";

:root {
  --background: #f7f7f8;
  --surface: #ffffff;
  --surface-muted: #f1f2f4;
  --border: #e2e4e9;
  --foreground: #17181c;
  --muted: #5f6470;
  --accent: #1d4ed8;
  --accent-soft: #e8eeff;
  --danger: #b3261e;
  --warning: #8a5300;
  --warning-soft: #fff4e0;
  --success: #14683f;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0e0f12;
    --surface: #171922;
    --surface-muted: #1f2230;
    --border: #2c3040;
    --foreground: #eceef4;
    --muted: #a0a6b8;
    --accent: #8fb0ff;
    --accent-soft: #1c2542;
    --danger: #ff9d95;
    --warning: #f0c07a;
    --warning-soft: #2e2413;
    --success: #6fd39d;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-border: var(--border);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-danger: var(--danger);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-success: var(--success);
  --font-sans: var(--font-sans-kr);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans-kr), -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
    "Malgun Gothic", sans-serif;
  word-break: keep-all;
}

/* 공지 원문 HTML 렌더링 (외부 CMS 마크업이라 인라인 스타일을 제거한 상태) */
.notice-body {
  line-height: 1.85;
}
.notice-body p { margin: 0.5rem 0; }
.notice-body img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.75rem 0; }
.notice-body a { color: var(--accent); text-decoration: underline; overflow-wrap: anywhere; }
.notice-body strong, .notice-body b { font-weight: 700; }
.notice-body ul, .notice-body ol { margin: 0.5rem 0 0.5rem 1.25rem; }
.notice-body ul { list-style: disc; }
.notice-body ol { list-style: decimal; }
.notice-body pre {
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0.5rem 0;
}
.notice-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
}
.notice-body th, .notice-body td {
  border: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  text-align: left;
}
.notice-body th { background: var(--surface-muted); font-weight: 600; }
/* 넓은 표가 페이지를 가로로 밀지 않게 한다 */
.notice-body-scroll { overflow-x: auto; }
```

### `src/app/layout.tsx`

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "화공 공지 모아보기 · 영남대 화학공학부",
  description:
    "영남대학교 화학공학부 학생을 위한 학교 공지 통합·맞춤 추천 서비스. 흩어진 게시판을 한곳에서 보고, 학년·관심 분야에 맞는 공지를 먼저 확인하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

`html`에 `h-full`, `body`에 `min-h-full flex flex-col` — 푸터를 화면 아래에 붙이기 위한 것이다.

### `src/components/ui.tsx`

배지·카드·섹션제목·빈상태·버튼 스타일·날짜 포맷. **버튼은 컴포넌트가 아니라 클래스 상수
(`buttonStyles`)로 내보낸다** — 서버/클라이언트 양쪽에서 `<button>`과 `<Link>`에 같은 모양을
붙여야 하기 때문이다.

```tsx
// src/components/ui.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "success" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-muted text-muted",
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    success: "bg-surface-muted text-success",
    danger: "bg-surface-muted text-danger",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-white hover:opacity-90 dark:text-[#0e0f12]`,
  secondary: `${buttonBase} border border-border bg-surface hover:bg-surface-muted`,
  ghost: `${buttonBase} text-muted hover:bg-surface-muted`,
  danger: `${buttonBase} border border-border text-danger hover:bg-surface-muted`,
};

export function LinkButton({
  href,
  variant = "secondary",
  children,
  external = false,
}: {
  href: string;
  variant?: keyof typeof buttonStyles;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonStyles[variant]}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}

/** 날짜는 항상 한국 시간 기준으로 표시한다 (수집 원본이 KST). */
export function formatDate(iso: string | Date, withTime = false): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function relativeDays(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  return formatDate(date);
}

/** 마감일까지 남은 일수 (음수면 지난 마감) */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
```

### `src/components/AppShell.tsx`

```tsx
// src/components/AppShell.tsx
import type { ReactNode } from "react";
import { Header } from "./Header";
import { getSessionUser } from "@/lib/session";

/** 학생 화면 공통 레이아웃 (헤더 + 본문 컨테이너) */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted">
        영남대학교 화학공학부 공지 통합 서비스 · 모든 공지의 원문은 영남대학교 공식 게시판에 있습니다.
      </footer>
    </>
  );
}
```

### `src/components/Header.tsx`

**서버 컴포넌트여야 한다.** 미읽음 개수를 서버에서 렌더해야 첫 화면부터 숫자가 맞고,
효과에서 setState를 부르는 패턴(REBUILD §6-8)을 피할 수 있다. 저장 공지 마감 알림도
여기서 갱신한다 — 사용자가 화면을 열 때가 유일한 실행 시점이다(스케줄러 없음).
데스크톱은 상단 인라인 내비, 모바일(`sm:hidden`)은 헤더 아래 가로 스크롤 내비 — **두 벌을 렌더한다.**

```tsx
// src/components/Header.tsx
import Link from "next/link";
import { NotificationBell } from "./NotificationBell";
import { LogoutButton } from "./LogoutButton";
import { prisma } from "@/lib/db";
import { ensureDeadlineNotifications } from "@/lib/notify";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/notices", label: "공지" },
  { href: "/saved", label: "저장" },
  { href: "/alerts", label: "알림 설정" },
  { href: "/profile", label: "프로필" },
];

export async function Header({ user }: { user: SessionUser | null }) {
  // 저장 공지 마감 알림(D-3/D-1/당일)을 먼저 갱신한 뒤 미읽음 개수를 센다.
  if (user) await ensureDeadlineNotifications(user.id);
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, isRead: false } })
    : 0;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href={user ? "/notices" : "/"} className="font-bold whitespace-nowrap">
          화공 공지 <span className="text-accent">모아보기</span>
        </Link>

        {user ? (
          <>
            <nav className="ml-2 hidden gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell initialUnread={unread} />
              <LogoutButton />
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/login" className="text-sm text-muted hover:text-foreground">
              관리자
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white dark:text-[#0e0f12]"
            >
              로그인
            </Link>
          </div>
        )}
      </div>

      {user ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
```

### `src/components/AdminShell.tsx`

```tsx
// src/components/AdminShell.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "./AdminLogoutButton";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/sources", label: "출처 관리" },
  { href: "/admin/crawls", label: "수집 상태" },
  { href: "/admin/duplicates", label: "중복 검토" },
  { href: "/admin/notices", label: "공지 수정" },
  { href: "/admin/feedback", label: "피드백" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/admin" className="font-bold whitespace-nowrap">
            관리자 <span className="text-accent">콘솔</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notices" className="text-sm text-muted hover:text-foreground">
              학생 화면
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
```

### `src/components/NoticeCard.tsx`

카드 전체가 `<Link>`다. 배지 순서는 **출처 → 고정 → 마감 D-n → 신청·제출 → 저장됨**으로 고정한다.
마감 배지는 `0 ≤ D ≤ 7`일 때만 띄운다(지난 마감은 목록에서 침묵).

```tsx
// src/components/NoticeCard.tsx
import Link from "next/link";
import { Badge, daysUntil, relativeDays } from "./ui";
import { interestLabel } from "@/lib/taxonomy";
import type { NoticeView } from "@/lib/notice-mapper";

interface Props {
  notice: NoticeView & { score?: number; reasons?: string[] };
  saved?: boolean;
  /** 추천 이유를 노출할지 (n14 AI 추천 목록에서 사용) */
  showReasons?: boolean;
}

export function NoticeCard({ notice, saved = false, showReasons = false }: Props) {
  const deadlineDays = notice.deadlineAt ? daysUntil(notice.deadlineAt) : null;

  return (
    <Link
      href={`/notices/${notice.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent hover:bg-surface-muted/50"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{notice.sourceName}</Badge>
        {notice.isPinned ? <Badge tone="warning">고정</Badge> : null}
        {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 ? (
          <Badge tone="danger">마감 D-{deadlineDays}</Badge>
        ) : null}
        {notice.actionRequired ? <Badge tone="warning">신청·제출</Badge> : null}
        {saved ? <Badge tone="success">저장됨</Badge> : null}
      </div>

      <h3 className="font-medium leading-snug">{notice.title}</h3>

      {notice.summary || notice.excerpt ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">
          {notice.summary ?? notice.excerpt}
        </p>
      ) : null}

      {showReasons && notice.reasons && notice.reasons.length > 0 ? (
        <p className="mt-2 text-xs text-accent">추천 이유 · {notice.reasons.join(" / ")}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{relativeDays(notice.publishedAt)}</span>
        {notice.writer ? <span>{notice.writer}</span> : null}
        <span>조회 {notice.views.toLocaleString("ko-KR")}</span>
        {notice.attachments.length > 0 ? <span>첨부 {notice.attachments.length}</span> : null}
        {notice.targetGrades.length > 0 ? (
          <span>{notice.targetGrades.join("·")}학년 대상</span>
        ) : null}
        {notice.aiTags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-muted">
            #{interestLabel(tag)}
          </span>
        ))}
      </div>
    </Link>
  );
}
```

### `src/components/NoticeList.tsx`

```tsx
// src/components/NoticeList.tsx
import { NoticeCard } from "./NoticeCard";
import { EmptyState } from "./ui";
import type { NoticeView } from "@/lib/notice-mapper";

export function NoticeList({
  notices,
  savedIds,
  showReasons = false,
  emptyTitle = "표시할 공지가 없습니다.",
  emptyDescription,
}: {
  notices: Array<NoticeView & { score?: number; reasons?: string[] }>;
  savedIds?: Set<string>;
  showReasons?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (notices.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="space-y-2.5">
      {notices.map((notice) => (
        <li key={notice.id}>
          <NoticeCard
            notice={notice}
            saved={savedIds?.has(notice.id)}
            showReasons={showReasons}
          />
        </li>
      ))}
    </ul>
  );
}
```

### `src/components/Pagination.tsx`

현재 쿼리스트링을 유지해야 하므로 href 생성을 **페이지가 주입**한다(`makeHref`).

```tsx
// src/components/Pagination.tsx
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
```

---

## 3. 화면별 구조

문구는 **따옴표 안 그대로**. 조건은 그대로 분기한다.

### `/` 랜딩

로그인 상태면 `user.onboardedAt`에 따라 `/notices` 또는 `/onboarding`으로 `redirect`.
`AppShell`을 쓰지 않고 `Header user={null}` + 자체 `main`/`footer`를 쓴다(푸터 문구가 다르다).

1. eyebrow — `text-sm font-medium text-accent` · "영남대학교 화학공학부"
2. h1 — `text-3xl font-bold leading-tight sm:text-4xl` · "흩어진 공지, 한곳에서" `<br />` "나에게 맞는 것부터"
3. 설명 — "학부공지·대학원공지·장학·현장실습·취업정보·영대소식을 매번 따로 확인하지 않아도 됩니다. 학년과 관심 분야를 알려주면 봐야 할 공지를 먼저 보여드립니다."
4. 버튼 2개 — "학번으로 시작하기"(accent 배경, `px-5 py-2.5`) / "관리자 로그인"(테두리)
5. 통계 한 줄 — `text-xs text-muted` · "현재 {활성 출처 수}개 게시판에서 공지 {숨김 제외 건수}건을 모아두었습니다."
6. `mt-12 grid gap-3 sm:grid-cols-3` — Card 3개
   - "통합 목록" / "게시판을 옮겨 다니지 않고 한 화면에서 모두 확인합니다. 출처·기간·키워드로 걸러볼 수 있습니다."
   - "맞춤 추천" / "학년·학업상태·관심 분야에 따라 점수를 매겨 정렬합니다. 왜 추천됐는지 이유도 함께 보여줍니다."
   - "요약과 알림" / "긴 공지는 핵심만 요약하고 마감일을 뽑아냅니다. 관심 키워드에 맞는 새 공지는 알림으로 받습니다."
7. "수집 중인 게시판" — 활성 출처 이름을 `rounded-full border` 칩으로 나열
8. 푸터 — "이 서비스는 학생 편의를 위한 비공식 프로젝트이며, 모든 공지의 원문은 영남대학교 공식 게시판에 있습니다."

### `/login`

`Header user={null}` + `max-w-md py-12`. 로그인 상태면 위와 같이 redirect.

1. "← 처음으로" (`text-sm text-muted`, `/`로) — **로그인 화면에서 랜딩으로 돌아갈 길을 반드시 둔다**
2. h1 `text-2xl font-bold` "로그인"
3. "학번을 입력하면 바로 시작합니다. 학교 포털 계정과는 별개이며 비밀번호를 받지 않습니다."
4. `LoginForm` — 카드형 폼(`rounded-xl border bg-surface p-5 space-y-4`)
   - 학번: 입력 즉시 숫자 외 문자 제거(`replace(/\D/g, "")`), `inputMode="numeric"`, placeholder "예: 22012345"
   - 이름: 라벨 "이름 (선택)", placeholder "화면 인사에만 사용됩니다"
   - 에러는 `text-sm text-danger`로 폼 안에
   - 제출 버튼 `w-full` — 6자리 미만이면 disabled, 진행 중엔 "확인 중…", 평시 "시작하기"

### `/onboarding`

`Header user={user}` + `max-w-2xl py-8`. 비로그인은 `/login`으로.

eyebrow "프로필 설정" → h1 "어떤 공지를 먼저 보여드릴까요?" →
"학년과 관심 분야를 알려주면 그에 맞춰 공지를 정렬합니다. 나중에 프로필에서 언제든 바꿀 수 있습니다." →
`ProfileForm submitLabel="저장하고 공지 보기" redirectTo="/notices"`

### `/notices` 통합 목록

`AppShell` + `space-y-8`. 쿼리: `q source category from to attach page`.
**필터·검색 중(`isFiltering`)이면 추천 섹션을 감춘다** — 지금 찾는 것에 집중하도록.

1. `FilterPanel` — `<Suspense>`로 감싸고 fallback은 `h-20 rounded-xl border bg-surface`
   (`useSearchParams`를 쓰므로 Suspense 없이는 빌드가 경고한다)
2. 추천 섹션 (필터링 중 아닐 때만)
   - `SectionTitle title="나에게 맞는 공지"`
   - description: 프로필 미완(관심분야 0개 또는 학년 없음)이면 "프로필을 채우면 추천 정확도가 올라갑니다.",
     아니면 "{학년}학년 · {관심분야 라벨들 쉼표}  기준"
   - action: `LinkButton href="/profile" variant="ghost"` "프로필 수정"
   - 프로필 미완 + 추천 0건 → `EmptyState` "아직 추천할 기준이 없습니다." /
     "학년과 관심 분야를 선택하면 그에 맞는 공지를 먼저 보여드립니다." / 버튼 "프로필 설정하기"
   - 그 외 → `NoticeList showReasons`, 빈 문구 "조건에 맞는 추천 공지가 없습니다." /
     "관심 분야를 더 추가하거나 아래 통합 목록에서 직접 찾아보세요."
   - 추천은 6건
3. 목록 섹션 — 제목 3분기: 검색어 있으면 `"{q}" 검색 결과`, 필터만 있으면 "필터 결과", 아니면 "전체 공지".
   description "{총건수}건" + 2페이지 이상이면 " · {현재}/{전체}페이지". 한 페이지 20건.
   - 0건 → `EmptyState` 제목 `"{q}"에 해당하는 공지가 없습니다.`(검색어 없으면 "조건에 맞는 공지가 없습니다.") /
     "다른 키워드로 검색하거나 필터 조건을 넓혀 보세요. 오래된 공지는 아직 수집되지 않았을 수 있습니다." /
     버튼 "조건 초기화"
   - 있으면 `NoticeList` + `Pagination`

`FilterPanel`(클라이언트): 한 줄에 [검색 입력 / "검색"(primary) / "필터"(secondary)].
"필터"를 누르면 `sm:grid-cols-2` 패널이 열린다 — 출처 select("전체 게시판"), 분류 select("전체 분류"),
게시일 시작/종료 `<input type="date">`, 체크박스 "첨부파일이 있는 공지만", 버튼 "조건 적용" / "초기화".
**초기 진입 시 필터 값이 하나라도 있으면 패널을 펼친 상태로 시작한다.** 조건이 바뀌면 항상 1페이지로.

### `/notices/[id]` 상세

`AppShell` + `<article className="space-y-5">`. 없는 id는 `notFound()`.

1. "← 공지 목록"
2. header — 배지(출처 / "고정 공지" / 마감 / "신청·제출 필요") ·
   마감 배지 tone은 `지남 → neutral, D≤7 → danger, 그 외 → warning`, 문구는 "마감 지남" 또는 "마감 D-{n}"
3. h1 `text-2xl font-bold leading-snug`
4. 메타 한 줄 — 게시일 / 작성자 / "조회 {n}" / "{n·m}학년 대상"
5. 버튼 — `LinkButton external variant="primary"` "영남대 원문 보기 ↗" + `SaveButton`
6. AI 요약 Card (`summary`가 있을 때만) — 틀 `border-accent/40 bg-accent-soft/40`,
   라벨 "AI 요약", 아래 `#태그` 배지들
7. 관련 이유 Card (`reasons`가 있을 때만) — "나에게 관련된 이유 (추천 점수 {score})" + `· ` 목록.
   **추천 목록과 같은 `scoreNotice`를 쓴다** — 다른 계산을 두 벌 만들면 설명이 어긋난다.
8. 본문 Card — `<div className="notice-body notice-body-scroll">`에 새니타이즈된 HTML.
   본문이 없으면(첨부·이미지만) "이 공지는 본문 없이 첨부파일이나 이미지로만 안내되어 있습니다. 원문에서 확인해 주세요."
9. 첨부 Card — "첨부파일 {n}건", 파일명 링크(`text-accent underline break-all`, 새 탭)
10. 피드백 Card — `FeedbackButtons`
11. "같은 게시판의 다른 공지" — 같은 출처 최신 5건, `divide-y` 목록에 제목 + 날짜

### `/saved`

`SectionTitle title="저장한 공지" description="{n}건 · 마감이 있는 공지는 먼저 확인하세요"`.
비었으면 `EmptyState` "저장한 공지가 없습니다." / "공지 상세 화면에서 '저장'을 누르면 여기에 모입니다." /
버튼 "공지 보러 가기". 있으면 각 항목이 `NoticeCard saved` + 아래 줄에
"{저장일}에 저장"(왼쪽) / `SaveButton onUnsaved`(오른쪽, 누르면 목록 새로고침).

### `/alerts`

`SectionTitle title="알림 설정" description="새 공지가 수집될 때 조건에 맞으면 헤더의 알림에 쌓입니다. 이메일이나 푸시는 보내지 않습니다."`

폼은 fieldset 5블록: **알림 받기**(체크박스) · **키워드**(placeholder "키워드 입력 후 Enter", 칩으로 쌓고 × 로 제거) ·
**관심 분야**(프로필 값 기본 제안) · **게시판 제한 (선택)** · **추천 점수 기준**(키워드·관심분야가
모두 비었을 때만 쓰이는 값이라는 설명을 함께). 저장 결과는 `text-success` 한 줄.

### `/profile`

`space-y-6`, `SectionTitle title="프로필·관심사" description="추천에 쓰이는 정보입니다."`

1. 요약 Card — `<dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">` 학번 / 이름 / 학년 / 학업 상태 /
   관심 분야(`sm:col-span-2`). 없는 값은 "미설정"(이름은 "—"), 5학년은 "5학년 이상".
   구분선 아래 "저장한 공지 {n}건 · 보낸 피드백 {n}건 · 받은 알림 {n}건"
2. "정보 수정" — `ProfileForm submitLabel="수정 내용 저장"`
3. "프로필 초기화" — Card 안에 설명 "학년·학업 상태·관심 분야와 알림 설정을 모두 지우고 처음 설정
   화면으로 돌아갑니다. 저장한 공지는 그대로 남습니다." + `ResetProfileButton`(2단 확인)

`ProfileForm`은 온보딩과 프로필이 **같은 컴포넌트를 공유**한다(submitLabel만 다르다). fieldset 3개:
학년(1~5, 5는 "5학년 이상") + 학업 상태 → 관심 분야(`sm:grid-cols-2`, 라벨+설명 2줄, 복수 선택) → 이름(선택).
선택된 버튼은 `border-accent bg-accent-soft text-accent`, `aria-pressed`로 상태를 노출한다.
누른 값을 다시 누르면 해제된다. 마지막 줄에 "선택하지 않아도 통합 목록은 볼 수 있습니다."

### 관리자 화면

전부 `AdminShell`. 내비 6개: 대시보드 / 출처 관리 / 수집 상태 / 중복 검토 / 공지 수정 / 피드백.
헤더 오른쪽에 "학생 화면" 링크와 "로그아웃".

| 경로 | 제목 · 설명 |
|---|---|
| `/admin/login` | h1 "관리자 로그인" + 비밀번호 폼. 여기도 "← 처음으로"를 둔다 |
| `/admin` | "운영 현황" 타일 + "최근 수집"(없으면 "아직 수집 기록이 없습니다.") + "점검이 필요한 항목"(없으면 "특별히 점검할 항목이 없습니다.") |
| `/admin/sources` | "공지 출처 관리" / "영남대 게시판은 모두 같은 CMS를 쓰므로 게시판 경로만 등록하면 같은 파서로 수집됩니다." |
| `/admin/crawls` | "수집 상태" / "최근 60건의 수집 이력입니다." — 실패·부분 성공 설명, "출처별 마지막 수집" 표(출처·누적 공지·마지막 수집·상태) |
| `/admin/duplicates` | "중복 공지 검토" / "서로 다른 게시판에 같은 공지가 올라온 경우를 찾아 보여줍니다. 통합하면 한쪽을 숨겨 학생 목록에 하나만 남습니다." |
| `/admin/notices` | "공지 오류·수정" / "본문이 비었거나 학생이 오류를 신고한 공지를 확인하고, 숨기거나 제목·요약을 고칠 수 있습니다." |
| `/admin/feedback` | "피드백 조회" / "학생이 공지 상세에서 남긴 추천·요약 관련 의견입니다." — "피드백이 많은 공지" + 표(시각·종류·공지·학생·내용) |

---

## 4. 클라이언트 컴포넌트 (이것만 `"use client"`)

| 파일 | 하는 일 | 화면에 보이는 상태 |
|---|---|---|
| `login/LoginForm.tsx` | 학번 제출 → `needsOnboarding`로 분기 | "시작하기" / "확인 중…" |
| `components/ProfileForm.tsx` | 학년·상태·관심분야 토글, PUT `/api/profile` | 저장 중 "저장 중…", 성공 "저장했습니다." |
| `components/FilterPanel.tsx` | 검색·필터 → 쿼리스트링 push | 패널 열림/닫힘, "초기화" |
| `components/NotificationBell.tsx` | 드롭다운, 목록 fetch, 모두 읽음 | 미읽음 배지 숫자, "불러오는 중…", "아직 알림이 없습니다." |
| `components/SaveButton.tsx` | 저장 토글 (POST/DELETE) | "저장" ↔ "저장됨"(primary), `aria-pressed` |
| `components/FeedbackButtons.tsx` | 피드백 4종 전송 | 전송 후 "의견을 보냈습니다. 추천과 요약 품질 개선에 사용됩니다." |
| `components/LogoutButton.tsx` / `AdminLogoutButton.tsx` | 로그아웃 후 이동 | "로그아웃" |
| `profile/ResetProfileButton.tsx` | 2단 확인 초기화 | 1단 "프로필 초기화" → 2단 "정말 초기화할까요?" + "초기화하고 다시 설정" / "취소" |
| `alerts/AlertSettingsForm.tsx` | 알림 기준 저장 | 키워드 칩, 저장 결과 |
| `admin/login/AdminLoginForm.tsx` | 비밀번호 제출 | 에러 문구 |
| `admin/sources/SourceManager.tsx` | 출처 등록·수정·활성토글·수동수집 | 수집 진행/결과 |
| `admin/duplicates/DuplicateReviewer.tsx` | 통합/별개 확정 | 처리 후 목록 갱신 |
| `admin/notices/NoticeEditor.tsx` | 숨김·제목·요약·메모 수정 | 저장 결과 |

알림 벨 드롭다운: `w-[min(22rem,calc(100vw-2rem))]`, 헤더에 "알림" + "모두 읽음"(accent) + "설정",
목록은 `max-h-80 overflow-y-auto`, 미읽음 행은 배경으로 구분한다.

---

## 5. 문구 원칙

- **평서문 존댓말.** "~합니다 / ~하세요". 느낌표·이모지 남용 금지(벨 🔔만 예외).
- 빈 상태는 **왜 비었는지 + 다음에 뭘 할지**를 같이 준다. "데이터가 없습니다."로 끝내지 않는다.
- 추정값은 추정이라고 말한다. 마감일·대상학년은 본문에서 뽑은 값이므로 상세에서 원문 링크를 항상 붙인다.
- 학번 로그인은 학교 계정이 아니라는 사실을 로그인 화면에서 명시한다.
- 숫자는 `toLocaleString("ko-KR")`, 날짜는 `formatDate`(Asia/Seoul 고정), 목록은 `relativeDays`
  ("오늘 / 어제 / n일 전 / n주 전 / 날짜").

---

## 6. 대조 체크리스트

원본과 같은 화면인지 이 순서로 확인한다. 하나라도 다르면 §2 파일을 다시 대조하라.

- [ ] 라이트/다크 양쪽에서 배경-카드-테두리 대비가 보인다 (다크에서 카드가 배경에 묻히지 않는다)
- [ ] accent 버튼의 글자가 다크모드에서 검정(`dark:text-[#0e0f12]`)이다
- [ ] 헤더가 스크롤에 붙어 있고(`sticky top-0`) 반투명 배경 + `backdrop-blur`다
- [ ] 모바일 폭(375px)에서 헤더 아래 내비가 가로 스크롤로 나타난다
- [ ] 공지 카드 배지 순서가 출처 → 고정 → 마감 → 신청·제출 → 저장됨이다
- [ ] 마감이 8일 이상 남은 공지의 목록 카드에는 마감 배지가 없다
- [ ] 검색하면 추천 섹션이 사라진다
- [ ] 표가 넓은 공지 상세에서 **페이지가 가로로 밀리지 않고 표만 스크롤된다**
- [ ] 본문 없는 공지 상세가 빈 카드가 아니라 안내 문구를 보여준다
- [ ] 긴 한국어 제목이 단어 중간에서 끊기지 않는다 (`word-break: keep-all`)
- [ ] 페이지네이션이 1페이지뿐일 때 렌더되지 않는다

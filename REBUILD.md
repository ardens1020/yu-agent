# 재구축 지침서 — 화공 공지 모아보기

> **이 문서를 읽는 Claude Code에게**
>
> 이 문서는 이미 한 번 완성·검증된 서비스를 다른 컴퓨터(Windows)에서 다시 만들기 위한 지침이다.
> 원본은 macOS에서 실제 영남대 공지 228건을 수집해 유저플로우 전 구간을 검증한 상태였다.
>
> **아래 "절대 다시 만들면 안 되는 버그" 절을 먼저 읽어라.** 그 항목들은 원본 개발 중
> 실제 데이터와 대조해서 잡은 버그다. 지침 없이 구현하면 같은 버그를 반복하게 된다.
>
> 코드를 그대로 옮길 수 있다면 이 문서로 재구축하지 말고 파일을 복사하는 게 정확하다.
> 이 문서는 (a) 파일 없이 처음부터 만들 때, (b) 옮긴 코드를 이해·수정할 때 쓴다.

---

## 1. 무엇을 만드는가

영남대학교 화학공학부 학생을 위한 **학교 공지 통합·맞춤 추천 서비스**.

해결하는 문제: 화공 학생은 학부공지·학부게시판·장학안내·현장실습공지·취업정보·대학원공지·영대소식 등
**최소 7개 게시판을 각각 따로** 확인해야 한다. 페이지네이션된 목록이라 놓치기 쉽고,
제목만으로는 자기와 관련 있는 공지인지 판단이 어렵다.

제공하는 것:
1. 게시판을 하나로 합친 **통합 목록** (출처·분류·기간·첨부·키워드 필터)
2. 학년·학업상태·관심 분야 기준 **맞춤 추천** — 추천 이유를 함께 표시
3. 공지 **요약·마감일·대상학년** 추출 (AI + 규칙 기반 2단)
4. 저장, 웹 내 알림
5. 관리자: 출처 관리, 수집 모니터링, 중복 검토, 오류 수정, 피드백 조회

범위 밖 (의도적으로 제외):
- 이메일·브라우저 푸시 알림 (웹 내 알림만)
- 실제 학교 포털 SSO (학번 입력만 받는 데모 로그인)
- 자동 스케줄 수집 (수동 실행만, `CrawlRun.trigger` 필드만 준비)
- 첨부파일(PDF·HWP) 내용 파싱 (파일명·링크만)

---

## 2. 기술 스택 (검증된 정확한 버전)

| 항목 | 버전 | 비고 |
|---|---|---|
| Node.js | 24.19.0 | 20 이상이면 동작. `process.loadEnvFile`이 필요하므로 **20.6+ 필수** |
| npm | 11.17.0 | `allowScripts` 승인 절차가 있는 버전 |
| next | 16.3.1 | App Router. `params`/`cookies()`가 **Promise**다 |
| react / react-dom | 19.2.8 | |
| typescript | 5.9.3 | |
| tailwindcss | 4.3.3 | v4 — `@import "tailwindcss"` 방식 |
| @tailwindcss/postcss | 4.3.3 | |
| prisma / @prisma/client | 7.9.1 | **v7은 스키마에 `url`을 못 쓴다** (아래 참고) |
| @prisma/adapter-better-sqlite3 | 7.9.1 | v7은 드라이버 어댑터가 필수 |
| better-sqlite3 | 12.11.1 | 네이티브 모듈 — Windows 주의 대상 |
| cheerio | 1.2.0 | HTML 파싱 |
| @anthropic-ai/sdk | 0.117.1 | AI 요약 |
| zod | 4.4.3 | 구조화 출력 스키마 |
| tsx | 4.23.12 | devDependency. CLI 스크립트 실행 |
| eslint / eslint-config-next | 9.39.5 / 16.3.1 | |

---

## 3. Windows 환경 준비 (여기서 막히는 경우가 가장 많다)

### 3-1. better-sqlite3 네이티브 빌드

`better-sqlite3`는 네이티브 모듈이다. 보통 Windows x64용 **prebuilt 바이너리**를 받아서
그냥 설치되지만(`prebuild-install`), 실패하면 `node-gyp rebuild`로 넘어가고 그때는 빌드 도구가 필요하다.

먼저 그냥 설치를 시도하고, 실패했을 때만 아래를 설치한다:

```powershell
# 실패 시에만
winget install Microsoft.VisualStudio.2022.BuildTools
# 설치 관리자에서 "C++를 사용한 데스크톱 개발" 워크로드 선택
winget install Python.Python.3.12
```

설치 후 `npm rebuild better-sqlite3`로 재시도한다.

> **prebuilt를 못 받는 상황이 반복되면** `@prisma/adapter-better-sqlite3` 대신
> `@prisma/adapter-libsql` + `@libsql/client`(순수 JS, 네이티브 빌드 없음)로 바꾸는 것을 고려한다.
> 다만 원본은 better-sqlite3로 검증됐으므로 먼저 이쪽을 시도하라.

### 3-2. npm의 install script 차단 (npm 11)

이 npm 버전은 패키지의 install script를 기본 차단한다. 설치 후 이런 경고가 나온다:

```
npm warn allow-scripts N packages have install scripts not yet covered by allowScripts
```

**Prisma와 better-sqlite3는 install script가 반드시 실행돼야 한다.** 승인한다:

```powershell
npm approve-scripts prisma @prisma/engines esbuild unrs-resolver
npm approve-scripts better-sqlite3
```

승인 결과는 `package.json`의 `allowScripts`에 기록된다. 원본의 최종 상태:

```json
"allowScripts": {
  "prisma@7.9.1": true,
  "@prisma/engines@7.9.1": true,
  "esbuild@0.28.2": true,
  "unrs-resolver@1.12.2": true,
  "better-sqlite3@12.11.1": true,
  "fsevents@2.3.3": true
}
```

`fsevents`는 macOS 전용이므로 Windows에서는 나타나지 않는다. 무시한다.
승인 없이 진행하면 `npx prisma --version`부터 실패한다.

### 3-3. 줄바꿈 (CRLF)

```powershell
git config --global core.autocrlf input
```

설정하지 않으면 파일 전체가 변경된 것으로 보인다. 동작에는 문제없지만 diff가 지저분해진다.

### 3-4. 셸

README와 이 문서의 명령은 `npx` 기반이라 PowerShell·cmd·Git Bash 모두에서 동작한다.
`.env` 파일을 만들 때만 PowerShell 문법에 주의한다(heredoc이 없다):

```powershell
@"
DATABASE_URL="file:./dev.db"
"@ | Out-File -FilePath .env -Encoding utf8
```

또는 그냥 에디터로 만든다.

---

## 4. 프로젝트 초기화

```powershell
npx create-next-app@latest yu-agent --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack --yes
cd yu-agent
npm i prisma @prisma/client @prisma/adapter-better-sqlite3 cheerio @anthropic-ai/sdk zod
npm i -D tsx
npm approve-scripts prisma @prisma/engines esbuild unrs-resolver better-sqlite3
npx prisma --version    # 여기서 성공해야 다음 단계로 간다
```

### 4-1. 환경변수

`.env` (Prisma CLI가 읽는다):
```
DATABASE_URL="file:./dev.db"
```

`.env.local` (Next.js 런타임이 읽는다):
```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="변경하세요-임의의-긴-문자열"
ADMIN_PASSWORD="yuadmin"
# ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL="claude-opus-5"
```

`.gitignore`에 추가:
```
/dev.db
/dev.db-journal
/src/generated
.env.local
```

### 4-2. Prisma 7 설정 — v6과 다르다

**스키마에 `url`을 쓸 수 없다.** 쓰면 `P1012` 에러가 난다:

```prisma
datasource db {
  provider = "sqlite"
  // url 없음 — prisma.config.ts로 옮겼다
}

generator client {
  provider = "prisma-client"          // "prisma-client-js" 아님
  output   = "../src/generated/prisma"
}
```

프로젝트 루트에 `prisma.config.ts`:

```ts
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7은 .env를 자동으로 읽지 않는다.
process.loadEnvFile?.(path.join(process.cwd(), ".env"));

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: { path: path.join("prisma", "migrations") },
  datasource: { url: env("DATABASE_URL") },
});
```

`process.loadEnvFile`을 빼면 `Cannot resolve environment variable: DATABASE_URL`로 실패한다.

클라이언트는 어댑터를 넘겨 만든다. **클래스명은 `PrismaBetterSqlite3`다** (`SQLite` 아님):

```ts
// src/lib/db.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

CLI 스크립트용 환경변수 로더도 따로 필요하다 (`src/lib/load-env.ts`):

```ts
import path from "node:path";
for (const file of [".env", ".env.local"]) {
  try { process.loadEnvFile?.(path.join(process.cwd(), file)); } catch {}
}
```

모든 `src/scripts/*.ts` 첫 줄에서 `import "../lib/load-env";`로 불러온다.

---

## 5. 영남대 CMS 구조 (실측 검증 완료 · 2026-08-18 기준)

**가장 중요한 발견: 영남대 전 게시판이 동일한 CMS 엔진을 쓴다.**
`che`(화학공학부)와 `main`(영대소식) 게시판의 HTML을 직접 비교해 확인했고,
한 번도 분석하지 않은 신소재공학부 게시판(`/mse/master/board.do`)에 같은 파서를 적용해 즉시 수집에 성공했다.

**따라서 파서는 하나만 만들고, 출처는 경로만 다르게 등록한다.**

### 5-1. URL 규칙

```
목록  https://www.yu.ac.kr{listPath}?mode=list&articleLimit=10&article.offset={N}
상세  https://www.yu.ac.kr{listPath}?mode=view&articleNo={articleNo}
첨부  https://www.yu.ac.kr{listPath}?mode=fileDownload&articleNo={x}&attachNo={y}
```

`article.offset`은 0, 10, 20 … (articleLimit 배수). 봇 차단 없음, UTF-8.

### 5-2. 목록 페이지 셀렉터

| 대상 | 셀렉터 |
|---|---|
| 테이블 | `table.board-table` |
| 행 | `table.board-table tbody tr` |
| 제목 링크 | `td.b-td-left .b-title-box a[href*="mode=view"]` |
| 제목 텍스트 | 위 `<a>` 안의 `<span>`, **없으면 `<a>` 직속 텍스트** |
| 상단 고정 여부 | `td.b-num-box .b-notice` 존재 여부 |
| 모바일 블록(폴백용) | `.b-m-con .b-date`, `.b-m-con .hit` |
| 첨부 (목록에도 있다) | `.b-popup-file-box ul li a[href*="fileDownload"]` |
| 페이지 메타 | 인라인 스크립트의 `siteId`, `boardNo` |

**목록 페이지만으로 제목·작성자·날짜·조회수·첨부파일명까지 다 얻는다.**
그러므로 상세 요청은 **신규 공지의 본문**을 위해서만 보낸다.

### 5-3. 컬럼 구성이 게시판마다 다르다 — 고정 인덱스 금지

예: `학술·공연·행사`(boardNo 34)는 카테고리 `<td>`가 추가되고 **작성자·작성일·조회 컬럼이 아예 없다.**

**반드시 `<thead>`의 `<th>` 라벨을 읽어 컬럼 인덱스를 매핑하라.** 매칭 규칙:

| 키 | 라벨 판정 |
|---|---|
| num | `=== "번호"` |
| title | `제목` 포함 |
| writer | `작성자` 또는 `등록자` 포함 |
| date | `작성일`·`등록일`·`날짜` 포함 |
| views | `조회` 포함 |
| file | `파일` 또는 `첨부` 포함 |
| category | `구분`·`분류`·`카테고리` 포함 |

값이 없을 때 폴백 순서: **컬럼 → `.b-m-con` 모바일 블록 → 상세 페이지**.
목록·상세 둘 다 날짜가 없으면 그 공지는 건너뛴다.

제목 셀(`td.b-td-left`)의 텍스트를 그대로 쓰면 모바일 블록이 섞여 오염된다.
`$cell.clone().find(".b-m-con").remove().end().text()`로 제거하고 읽어라.

### 5-4. 상세 페이지 셀렉터

| 대상 | 셀렉터 |
|---|---|
| 루트 | `.bn-view-common01, .board.view, body` 중 첫 번째 |
| 제목 | `.b-title-box .b-title` |
| 작성자 | `.b-writer-box span:nth-of-type(2)` |
| 등록일 | `.b-date-box` 중 **라벨에 `등록일`/`작성일`이 있는 것**의 `span:nth-of-type(2)` |
| 조회수 | `.b-hit-box span:nth-of-type(2)` |
| 본문 | `.b-content-box .fr-view`, **없으면 `.b-content-box`** |

`.fr-view`가 없고 `<pre class="pre">`만 있는 게시판이 있으므로 `.b-content-box` 폴백이 필요하다.

### 5-5. 출처 목록 (전부 HTTP 200 확인)

| 이름 | listPath | boardNo | category | sortOrder |
|---|---|---|---|---|
| 화공 학부공지 | `/che/notice/notice.do` | 251 | DEPT | 1 |
| 화공 학부게시판(선수강지도) | `/che/notice/bulletin-board.do` | 253 | DEPT | 2 |
| 화공 장학안내 | `/che/notice/scholarship-guidance.do` | 1947 | SCHOLARSHIP | 3 |
| 화공 현장실습공지 | `/che/notice/field-training-announcement.do` | 1948 | INTERNSHIP | 4 |
| 화공 취업정보 | `/che/notice/employment.do` | 254 | CAREER | 5 |
| 화공 대학원공지 | `/che/notice/graduate-school-announcement.do` | 671 | GRAD | 6 |
| 영대소식(학교 전체) | `/main/intro/yu-news.do` | 5 | UNIV | 7 |
| 학술·공연·행사 | `/main/intro/academic-performance-and-event.do` | 34 | EVENT | 8 |

`siteId`는 경로의 첫 세그먼트(`che`, `main`)다.
선택 확장: `/che/bk21/notice.do`(259, BK21 공지).

> **주의: 이 구조는 2026-08-18 실측 기준이다.** 학교가 CMS를 바꾸면 셀렉터가 깨진다.
> 구현 후 반드시 §10의 파서 검증을 실행해 실제 응답과 대조하라.

---

## 6. 절대 다시 만들면 안 되는 버그

원본 개발 중 **실제 데이터와 대조해서 잡은** 버그들이다. 지침 없이 구현하면 그대로 재현된다.

### 6-1. 행사 게시판 날짜가 미래로 저장됨

`학술·공연·행사` 상세에는 `.b-date-box`가 **두 개**다:
```html
<li class="b-date-box"><span>등록일 :</span><span>2026.07.15</span></li>
<li class="b-date-box"><span>기간</span><span>2026-11-21 ~ 2026-11-22</span></li>
```
`.last()`로 뽑으면 **행사 기간을 게시일로 저장**한다(실제로 2026-11-21이 저장됐다).

→ **`등록일`/`작성일` 라벨이 붙은 박스를 우선 선택하고, 없으면 첫 번째를 쓴다.**

### 6-2. 첨부파일 이름을 놓침

대부분 게시판에서 `a.b-file-dwn`은 파일명 없는 **보조 링크**다. 그래서 스킵하는 게 맞다.
그런데 `학술·공연·행사`만 `a.b-file-dwn`에 **파일명이 직접 들어 있다.**

→ 클래스로 스킵하지 말고 **텍스트 유무로 판단**한다:
- `b-file-preview`, `b-file-util`은 스킵
- `.hide`(스크린리더 전용) 텍스트를 제거한 뒤 남는 텍스트가 있으면 채택
- 없으면 `title` 속성에서 `다운로드|보기|새 창 열림` 접미어를 제거해 사용
- `attachNo` 기준으로 중복 제거 (데스크톱/모바일 블록에 같은 파일이 두 번 나온다)

### 6-3. 마감일 오탐 — 거짓 마감일은 잘못된 정보다

처음 구현은 165건을 뽑았지만 원문과 대조하니 세 종류 오답이 있었다:

| 오답 | 원문 | 원인 |
|---|---|---|
| 배부일을 마감으로 | "학위복 배부 · 일시: 2026. 8. 21." | 마감 아닌 날짜 |
| 휴진일을 마감으로 | "치과 휴진 안내 8/14(금)" | 마감 아닌 날짜 |
| 학술대회 개최일을 마감으로 | "일 시 : 2026년 8월 21일~22일" | 단독 `~`를 마감 신호로 봄 |
| **범위 시작일**을 마감으로 | "접수기간 : 2026. 8. 13.(목) ~ 8. 20.(목) 16:00까지" → 8/13 | 가장 이른 날짜를 취함 |

→ 아래 4가지를 모두 적용한다:

1. **단독 `~`를 마감 신호로 쓰지 않는다.** 마감 마커는
   `까지|마감|접수 기한|신청 기한|제출 기한|접수 기간|신청 기간|모집 기간|제출 기간|접수:|기한 :` 만.
2. **부정 문맥 구간은 건너뛴다**:
   `일 시|일자 :|휴진|배부|개최|공연|상영|진료|실습 기간|근무 기간|교육 기간|파견 기간|행사|시상|발표일|면접일|오리엔테이션`
3. **구간 안에서는 가장 늦은 날짜**를 마감으로 본다. 여러 구간이면 그중 **가장 이른** 마감을 택한다.
4. 연도 있는 날짜(`2026. 8. 13.`)를 먼저 수집하고 **그 부분을 공백으로 마스킹한 뒤**
   연도 없는 날짜(`8. 20.`)를 수집한다. 마스킹하지 않으면 범위의 끝을 놓친다.
5. **`actionRequired`가 false인 공지에는 마감일을 붙이지 않는다.**
   단순 안내(배부·휴진)에 마감을 붙이는 것을 막는 가장 효과적인 게이트다.

결과: 165건 → 71건. **놓치는 건 늘지만 거짓 마감일보다 안전한 트레이드오프다.**

### 6-4. 대상학년 오탐 — 잘못된 학년은 추천에서 감점이라 해롭다

본문에는 **교과목 개설 학년**이 흔히 나온다. 그걸 대상 학년으로 읽으면 안 된다:
- `[수강신청] 타전공인정 교과목 안내` → 본문의 "2학년 1학기 개설"을 읽어 대상=2·3·4로 오판
- `공인출석 발급 절차 안내` → 본문의 "졸업예정자" 언급으로 대상=4·5로 오판 (실제는 전학년)

→ **대상·자격을 명시한 문맥과 제목에서만 추출한다:**
1. 제목의 학년 표기는 신뢰한다.
2. 본문은 문장 단위로 쪼개고, 아래 마커가 있는 문장만 본다:
   `대상|자격|신청자격|지원자격|참가자격|응시자격|모집대상|참여대상|해당자|한함|한정|이상만|재학생|필독`
3. 그 문장에 `N학년 1학기`/`N학년 2학기` 패턴이나 `개설|이수구분|교과목명|시간표`가 있으면 **건너뛴다.**
4. `전학년|전체학년|모든학년|재학생전체|학부생전체`가 있으면 빈 배열(전체 대상).
5. 5개 학년이 다 잡히면 사실상 전학년이므로 빈 배열로 되돌린다.
6. 애매하면 빈 배열이 안전하다.

해석 규칙: `N학년 이상` → N~5, `N학년 이하` → 1~N, `2~4학년` → 2,3,4,
`1,2학년`/`1·2학년` → 개별, `졸업예정|졸업대상|최종학기` → 4,5, `신입생` → 1.

결과: 98건 → 44건.

### 6-5. SQLite는 `createMany`의 `skipDuplicates`를 지원하지 않는다

중복 후보(`DuplicateCandidate`)와 알림(`Notification`)은 유니크 제약이 있어
`createMany`로 넣으면 충돌 시 **전체가 실패**한다.

→ **삽입 전에 기존 행을 조회해 직접 걸러낸다.** 예:
```ts
const existing = await prisma.notification.findMany({
  where: { noticeId: { in: noticeIds } },
  select: { userId: true, noticeId: true },
});
const seen = new Set(existing.map((e) => `${e.userId}|${e.noticeId}`));
const fresh = rows.filter((r) => !seen.has(`${r.userId}|${r.noticeId}`));
```

### 6-6. `contentText`의 `null`과 `""`를 구분하라

`null` = 상세 요청 자체를 못 함(재시도 대상)
`""` = 상세를 받았지만 본문이 실제로 없는 공지(**재시도하면 안 됨**)

구분하지 않으면 본문이 이미지뿐인 공지(실제로 존재한다)를 매 수집마다 다시 요청한다.
`createNotice`에서 `contentText: detail ? detail.contentText : null`로 저장하고,
재시도 조건은 `prior.contentText === null`로 한다.

### 6-7. 본문이 이미지뿐인 공지가 실제로 있다

`.fr-view`에 `<img>` 하나만 있는 공지가 있다. 파서는 정상이고 텍스트가 진짜 없다.
상세 화면에서 **본문 HTML을 렌더링**해야 학생이 정보를 얻는다. 그때:
- `src`/`href`의 상대 경로(`/_attach/...`)를 `https://www.yu.ac.kr/`로 절대화
- `script|iframe|object|embed|form|link|meta` 태그와 `on*=` 핸들러 제거
- 원문 인라인 `style` 제거 (고정 폰트·색이 다크 모드에서 안 읽힌다)

### 6-8. React: 효과에서 setState 호출 금지 (eslint 에러)

알림 개수를 `useEffect`로 fetch하면 `react-hooks/set-state-in-effect` **에러**로 빌드가 막힌다.

→ **안 읽은 개수는 서버 컴포넌트(`Header`)에서 세어 prop으로 넘긴다.**
목록은 패널을 열 때만 fetch한다. 효과가 사라지고 요청도 줄어든다.
`Header`는 `async` 함수 컴포넌트가 된다.

### 6-9. Next.js 16: `params`와 `cookies()`는 Promise다

```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
// route handler
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
// session
const store = await cookies();
```

`searchParams`도 `Promise<Record<string, string | string[] | undefined>>`다.

### 6-10. SQLite에 JSON 타입이 없다

배열 필드(`attachments`, `aiTags`, `targetGrades`, `interests`, `keywords`, `sourceIds`)는
**`String`으로 선언하고 `JSON.stringify`/안전 파싱 헬퍼로 다룬다.**

```ts
export function parseJsonArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? (p as T[]) : fallback; }
  catch { return fallback; }
}
export function toJson(value: unknown): string { return JSON.stringify(value ?? []); }
```

기본값은 `@default("[]")`.

### 6-11. 추천 목록에 사실상 같은 공지가 중복 노출됨

재게시나 복수 게시판 노출로 제목이 거의 같은 공지가 추천에 2번 나왔다
(`[해외인턴] 해외 인턴프로그램 참여자 모집(미국)(IGE)`).

→ `rankNotices`에서 **정규화 제목 기준으로 중복 제거**한 뒤 상위 N개를 취한다.
정규화: 대괄호·소괄호 태그 제거 → 문자·숫자만 남김 → 소문자.

### 6-12. 관심 분야 키워드 `학사`는 중의적이다

`학사`를 키워드에 넣으면 **`학사학위`** 언급이 있는 연구원 채용 공고가
"수강신청·학사" 관심 프로필에 매칭됐다.

→ 단독 `학사`를 쓰지 말고 `학사일정|학사안내|학사공지|학사경고`처럼 구체화한다.

---

## 7. 데이터 모델

`prisma/schema.prisma`. 배열은 모두 `String`(JSON 문자열)이다.

```prisma
model Source {
  id            String     @id @default(cuid())
  name          String
  siteId        String                    // "che" | "main"
  boardNo       String
  listPath      String     @unique         // "/che/notice/notice.do" — 사실상 식별자
  category      String                    // DEPT|GRAD|SCHOLARSHIP|INTERNSHIP|CAREER|UNIV|EVENT
  isActive      Boolean    @default(true)
  sortOrder     Int        @default(0)
  lastCrawledAt DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  notices       Notice[]
  crawlRuns     CrawlRun[]
}

model Notice {
  id             String    @id @default(cuid())
  sourceId       String
  source         Source    @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  articleNo      String
  title          String
  writer         String?
  publishedAt    DateTime
  views          Int       @default(0)
  contentHtml    String?
  contentText    String?                   // null=상세 실패, ""=본문 없는 공지
  originUrl      String
  attachments    String    @default("[]")  // [{name,url}]
  isPinned       Boolean   @default(false)
  contentHash    String
  summary        String?                   // AI 요약
  aiTags         String    @default("[]")
  deadlineAt     DateTime?
  targetGrades   String    @default("[]")
  actionRequired Boolean   @default(false)
  enrichedAt     DateTime?                 // null이면 AI 요약 전
  isHidden       Boolean   @default(false)
  adminNote      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  saved          SavedNotice[]
  feedbacks      Feedback[]
  notifications  Notification[]
  @@unique([sourceId, articleNo])
  @@index([publishedAt])
  @@index([contentHash])
}

model User {
  id             String    @id @default(cuid())
  studentId      String    @unique
  name           String?
  grade          Int?
  academicStatus String?                   // ENROLLED|LEAVE|GRADUATING|GRAD_STUDENT
  interests      String    @default("[]")
  onboardedAt    DateTime?                 // null이면 온보딩 필요
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  saved          SavedNotice[]
  feedbacks      Feedback[]
  alertSetting   AlertSetting?
  notifications  Notification[]
}

model SavedNotice {
  id        String   @id @default(cuid())
  userId    String
  noticeId  String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  notice    Notice   @relation(fields: [noticeId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, noticeId])
}

model Feedback {
  id        String   @id @default(cuid())
  userId    String
  noticeId  String
  kind      String            // RECOMMEND_GOOD|RECOMMEND_BAD|SUMMARY_WRONG|CONTENT_ERROR
  comment   String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  notice    Notice   @relation(fields: [noticeId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@index([createdAt])
}

model AlertSetting {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled   Boolean  @default(true)
  keywords  String   @default("[]")
  interests String   @default("[]")
  sourceIds String   @default("[]")
  minScore  Int      @default(50)
  updatedAt DateTime @updatedAt
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  noticeId  String
  reason    String            // "키워드 \"장학\"" 처럼 사람이 읽을 수 있는 근거
  isRead    Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  notice    Notice   @relation(fields: [noticeId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, noticeId])
  @@index([userId, isRead])
}

model CrawlRun {
  id           String    @id @default(cuid())
  sourceId     String
  source       Source    @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?
  status       String            // RUNNING|SUCCESS|PARTIAL|FAILED
  fetched      Int       @default(0)
  created      Int       @default(0)
  updated      Int       @default(0)
  errorMessage String?
  trigger      String    @default("MANUAL")
  @@index([startedAt])
}

model DuplicateCandidate {
  id        String   @id @default(cuid())
  noticeAId String
  noticeBId String
  score     Float
  status    String   @default("PENDING")   // PENDING|MERGED|DISTINCT
  createdAt DateTime @default(now())
  @@unique([noticeAId, noticeBId])
  @@index([status])
}
```

```powershell
npx prisma migrate dev --name init
npx prisma generate
```

DB는 프로젝트 **루트**에 `dev.db`로 생긴다(`prisma/` 안이 아니다).

---

## 8. 모듈 구성

```
src/
├─ lib/
│  ├─ db.ts                 PrismaClient 싱글턴 + parseJsonArray/toJson
│  ├─ load-env.ts           CLI 스크립트용 .env 로더
│  ├─ session.ts            HMAC 서명 쿠키 세션 (학생/관리자)
│  ├─ admin-guard.ts        관리자 API 공통 가드
│  ├─ taxonomy.ts           관심분야·학업상태·출처분류·피드백종류 상수
│  ├─ extract.ts            규칙 기반 마감일·대상학년·신청필요 추출  ← §6-3, §6-4
│  ├─ recommend.ts          점수 계산 + 추천 이유 + 중복 제거        ← §6-11
│  ├─ dedupe.ts             중복 후보 탐지
│  ├─ notify.ts             알림 팬아웃
│  ├─ notices.ts            목록·검색·추천 조회 (페이지와 API 공용)
│  ├─ notice-mapper.ts      DB 행 → 화면 모델 + HTML 새니타이즈      ← §6-7
│  ├─ crawler/
│  │  ├─ sources.ts         출처 정의 + URL 빌더
│  │  ├─ yu-board.ts        범용 파서 (목록·상세·첨부·날짜·해시)     ← §6-1, §6-2
│  │  └─ run.ts             수집 실행 + CrawlRun 기록 + 추출 통합     ← §6-6
│  └─ ai/
│     ├─ client.ts          Anthropic 클라이언트 (키 없으면 null)
│     ├─ enrich.ts          구조화 출력 요약 (순차)
│     └─ batch.ts           Batches API (초기 대량, 50% 요금)
├─ components/  (ui, NoticeCard, NoticeList, FilterPanel, Pagination,
│                Header, AppShell, AdminShell, NotificationBell,
│                SaveButton, FeedbackButtons, ProfileForm, LogoutButton 등)
├─ app/         (§9 화면 표 참고)
└─ scripts/     (seed-sources, crawl, extract-heuristics, enrich,
                 verify-parser, inspect, recrawl-source)
```

### 8-1. 관심 분야 분류 (`taxonomy.ts`)

10개. 각 키에 매칭 키워드 배열을 붙여 추천·알림에 공용으로 쓴다.

| 키 | 라벨 | 키워드 예시 |
|---|---|---|
| `ACADEMIC` | 수강신청·학사 | 수강신청, 전공배정, 타전공, 선수강, 학점, 졸업요건, 이수, 휴학, 복학, 시간표 (**단독 `학사` 금지** §6-12) |
| `SCHOLARSHIP` | 장학금 | 장학, 국가장학, 근로장학, 학자금, 등록금, 성적우수, 장학사정 |
| `CAREER` | 취업·채용 | 취업, 채용, 모집, 신입, 면접, 자기소개서, 채용설명회, 잡페어 |
| `INTERNSHIP` | 인턴·현장실습 | 현장실습, 인턴, IPP, 산학, 실습학기, 채용연계, 해외인턴 |
| `GRAD_RESEARCH` | 대학원·연구 | 대학원, 석사, 박사, 연구실, 논문, 학술대회, BK21, 지도교수, 학위 |
| `CONTEST` | 공모전·대회 | 공모전, 경진대회, 해커톤, 창업, 현상공모, 캡스톤 |
| `EXCHANGE` | 교환학생·어학 | 교환학생, 해외연수, 어학, 토익, TOEIC, OPIc, 어학성적, 글로벌 |
| `STUDENT_LIFE` | 학생활동·행사 | 동아리, 학생회, 축제, 특강, 상담, 멘토링, 봉사, 간담회, 건강 |
| `CERTIFICATE` | 자격증·교육 | 자격증, 기사, 산업기사, 수료, 직무교육, 아카데미, 안전교육 |
| `ADMIN` | 병역·행정 | 예비군, 병역, 공인출석, 증명서, 제출, 신청서, 설문, 확인서 |

학업 상태: `ENROLLED`(재학) `LEAVE`(휴학) `GRADUATING`(졸업예정) `GRAD_STUDENT`(대학원생)
출처 분류: `DEPT` `GRAD` `SCHOLARSHIP` `INTERNSHIP` `CAREER` `UNIV` `EVENT`
피드백: `RECOMMEND_GOOD` `RECOMMEND_BAD` `SUMMARY_WRONG` `CONTENT_ERROR`

### 8-2. 추천 점수 (`recommend.ts`)

**LLM 없이 결정적으로 계산한다.** 그래서 추천 이유를 그대로 화면에 보여줄 수 있다.

```
점수 = 관심분야 매칭    제목 키워드 3점 / 본문 키워드 1점(최대 4) / AI태그 6점, 합계 최대 40
     + 학년 일치        targetGrades에 사용자 학년 포함 +25, 불일치 -15, 빈배열(전체) +8
     + 학업상태 일치     +15  (아래 우선순위 표)
     + 최신성           7일 내 +20, 30일 내 +10, 365일 초과 -10
     + 마감 임박         7일 내 +15, 지난 마감 -30
     + 신청·제출 필요    +10
     + 출처 가중치       DEPT 14, SCHOLARSHIP 12, INTERNSHIP 12, CAREER 11, GRAD 10, EVENT 2, UNIV 0
```

학업 상태별 우선 관심분야:
- `ENROLLED` → ACADEMIC, SCHOLARSHIP, STUDENT_LIFE
- `LEAVE` → ACADEMIC, ADMIN
- `GRADUATING` → CAREER, INTERNSHIP, CERTIFICATE
- `GRAD_STUDENT` → GRAD_RESEARCH, SCHOLARSHIP

점수는 0 이하로 내려가지 않게 clamp하고, `minScore` 20 이상만 추천한다.
정렬은 점수 내림차순 → 게시일 내림차순. 그 다음 **정규화 제목 중복 제거**(§6-11) → 상위 N개.

**`reasons` 배열을 함께 반환한다** (예: `["관심 분야 취업·채용·인턴·현장실습", "4학년 대상", "마감 D-3", "신청·제출 필요"]`).
공지 상세에서도 같은 함수로 "나에게 관련된 이유"를 보여준다.

### 8-3. 중복 탐지 (`dedupe.ts`)

최근 60일, 숨김 아닌 공지 대상.
1. 제목 정규화: 대괄호·소괄호 태그 제거 → 문자·숫자만 → 소문자
2. 토큰화: 태그 제거 후 2자 이상 토큰 집합
3. 점수: `contentHash` 일치 → 1.0 / 정규화 제목 일치 → 0.95 / 그 외 토큰 Jaccard
4. **서로 다른 `sourceId` 쌍만** 후보로 (같은 게시판 재게시는 제외)
5. 임계값 0.75 이상, id 순 정렬로 (A,B)/(B,A) 중복 등록 방지
6. 삽입 전 기존 쌍 필터링 (§6-5)

`MERGED` 처리 시 한쪽 `isHidden = true` + `adminNote`에 사유 기록.

### 8-4. 알림 (`notify.ts`)

수집 후 신규 공지 id 배열을 받아, 활성 `AlertSetting`마다 매칭한다.
- `sourceIds`가 있으면 그 게시판만
- 키워드가 제목·본문에 있으면 → `키워드 "장학"`
- 관심분야가 `aiTags`에 있거나 키워드가 제목에 있으면 → `관심 분야 장학금`
- **키워드·관심분야가 둘 다 비어 있으면** 추천 점수 ≥ `minScore` → `추천 점수 72점`
- 사유 최대 2개를 `, `로 이어 `reason`에 저장
- 삽입 전 기존 알림 필터링 (§6-5)

### 8-5. AI 요약 (`ai/`)

`ANTHROPIC_API_KEY`가 없으면 **`getAnthropic()`이 null을 반환하고 전부 건너뛴다.**
화면은 `contentText` 앞부분 발췌로 폴백한다. **키 없이도 서비스가 완전히 동작해야 한다.**

모델: `claude-opus-5` (env `ANTHROPIC_MODEL`로 교체 가능).

zod 스키마로 구조화 출력:
```ts
const NoticeEnrichment = z.object({
  summary: z.string(),                                    // 한국어 2~3문장
  tags: z.array(z.enum(INTEREST_KEYS)),                   // taxonomy 키만
  deadline: z.string().nullable(),                         // YYYY-MM-DD 또는 null
  targetGrades: z.array(z.number().int().min(1).max(5)),   // 빈배열 = 전체
  actionRequired: z.boolean(),
});
```

호출:
```ts
const response = await client.messages.parse({
  model: AI_MODEL,
  max_tokens: 2048,
  system: SYSTEM,
  output_config: { effort: "low", format: zodOutputFormat(NoticeEnrichment) },
  messages: [{ role: "user", content: `출처/게시일/제목/본문(8000자 컷)` }],
});
if (response.stop_reason === "refusal") return null;
return response.parsed_output ?? null;
```

- `zodOutputFormat`은 `@anthropic-ai/sdk/helpers/zod`에서 가져온다.
- `effort: "low"` — 요약·분류에 깊은 추론이 필요 없다. `output_config` 안에 넣는다.
- 시스템 프롬프트에 taxonomy 키 목록을 주입하고, **행사 개최일은 마감일이 아니라고 명시**한다.
- 결과를 DB에 캐시하고 `enrichedAt`을 채워 공지당 1회만 호출한다.
- 개별 실패는 로그만 남기고 건너뛴다(수집 전체를 실패시키지 않는다).
- 마감일 검증: 게시일보다 1년 이상 이전이면 잘못 뽑은 것으로 보고 버린다.

초기 대량 처리는 **Message Batches API** (표준 요금의 50%):
`custom_id`에 `Notice.id`를 넣고, 결과는 **순서가 보장되지 않으므로 `custom_id`로 매핑**한다.

### 8-6. 수집 실행 (`crawler/run.ts`)

출처 하나당:
1. `CrawlRun` 생성 (`RUNNING`)
2. 목록 N페이지 조회, `articleNo`로 중복 제거
3. 기존 공지 일괄 조회 → `articleNo` 맵
4. 신규: 상세 요청(예산 `maxDetails` 60건 상한) → **규칙 기반 추출 적용** → create
5. 기존: 제목·조회수·고정여부·게시일 **변경분만** update (AI 필드 보존).
   `contentText === null`이면 상세 재시도, 성공 시 추출도 다시 실행(단 `enrichedAt === null`일 때만)
6. `status`: 상세 실패 있으면 `PARTIAL`, 없으면 `SUCCESS`, 목록 자체 실패면 `FAILED`
7. `Source.lastCrawledAt` 갱신, `createdNoticeIds` 반환

요청 예절: User-Agent 지정, 페이지 간 300ms / 상세 간 250ms 지연, 실패 3회 재시도(지수 백오프).

`contentHash = sha256(공백제거 소문자 제목 + "|" + 공백제거 본문 앞 500자)`

날짜 파싱: `2026.08.18` / `2026.08.18 15:24` / `2026-08-18` → `YYYY-MM-DDTHH:mm:00+09:00` (KST).
**화면 표시는 항상 `toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })`로 한다.**
(`toISOString()`으로 찍으면 KST 자정이 전날 UTC 15:00으로 보여 하루 어긋난 것처럼 착각한다)

---

## 9. 화면 — 유저플로우 노드 대응

원본 유저플로우(mermaid)의 노드 번호를 그대로 대응시켰다. 각 화면 코드에 주석으로 노드 번호를 남긴다.

| 경로 | 노드 | 내용 |
|---|---|---|
| `/` | n1,n3,n4 | 랜딩. 로그인 상태면 온보딩 여부(n7)에 따라 자동 이동 |
| `/login` | n5,n6 | 학번(6~12자리 숫자) 입력. 없으면 계정 생성. `needsOnboarding` 반환 |
| `/onboarding` | n8,n9,n10,n11 | 학년·학업상태·관심분야 선택 → 저장 |
| `/notices` | n12,n13,n14,n21~n27 | 통합목록 + AI추천 + 필터·검색 + 빈결과 화면 |
| `/notices/[id]` | n16,n17,n18,n19,n20 | 상세, 원문 링크, 저장 토글, 피드백 |
| `/saved` | n28,n29,n30 | 저장 공지, 저장 취소 |
| `/alerts` | n31,n32,n33 | 알림 기준 (키워드·관심분야·게시판·점수) |
| 헤더 알림 벨 | n34,n35,n36 | 안읽음 개수(서버 렌더 §6-8), 목록, 공지 이동 |
| `/profile` | n37,n38,n39,n40,n41 | 프로필 조회·수정·초기화(2단 확인) |
| `/admin/login` | n42,n43 | 관리자 비밀번호 |
| `/admin` | n44 | 대시보드 (타일 + 점검 필요 항목) |
| `/admin/sources` | n45~n49 | 출처 목록·등록·수정·활성토글·수동수집 |
| `/admin/crawls` | n50,n51 | 수집 상태·이력·오류 |
| `/admin/duplicates` | n52,n53 | 중복 후보 검토 (통합/별개) |
| `/admin/notices` | n54,n55,n56 | 점검필요·오류신고·숨김 탭, 숨김·제목·요약·메모 수정 |
| `/admin/feedback` | n57,n58 | 피드백 집계·목록 |

### API

| 경로 | 메서드 |
|---|---|
| `/api/auth/login`, `/api/auth/logout` | POST |
| `/api/profile` | GET / PUT / DELETE(초기화) |
| `/api/notices` | GET (q, source, category, from, to, attach, page, perPage) |
| `/api/notices/recommended` | GET (limit) |
| `/api/notices/[id]/save` | POST / DELETE |
| `/api/notices/[id]/feedback` | POST |
| `/api/notifications` | GET / PATCH(읽음) |
| `/api/alerts/settings` | GET / PUT |
| `/api/admin/login`, `/api/admin/logout` | POST |
| `/api/admin/sources` | GET / POST / PATCH / DELETE(?id=) |
| `/api/admin/crawl` | POST (sourceId?, pages) |
| `/api/admin/duplicates` | PATCH (id, status, hideNoticeId?) |
| `/api/admin/notices` | PATCH (id, isHidden?, title?, summary?, adminNote?, clearEnrichment?) |

화면은 서버 컴포넌트에서 `lib/notices.ts`를 직접 호출하고, API는 클라이언트 변경 작업과 외부 접근용이다.
**같은 조회 로직을 두 번 쓰지 말고 `lib/notices.ts`를 공용으로 쓴다.**

### 세션

HMAC-SHA256 서명 쿠키. `value.signature` 형태, `timingSafeEqual`로 검증.
- 학생: 쿠키 `yu_session`, 값 = userId, 30일
- 관리자: 쿠키 `yu_admin`, 값 = `"admin"`, 8시간
- 옵션: `httpOnly`, `sameSite: "lax"`, `secure`는 프로덕션만
- `ADMIN_PASSWORD` 비교도 `timingSafeEqual` (길이 먼저 확인)

### 디자인

Tailwind v4. CSS 변수로 라이트/다크 토큰 정의(`prefers-color-scheme`), `@theme inline`으로 매핑.
`Noto_Sans_KR` 폰트, `word-break: keep-all`(한국어 줄바꿈).
공지 원문 HTML용 `.notice-body` 스타일 별도 정의 — 넓은 표는 `overflow-x: auto` 컨테이너로 감싼다.

---

## 10. 검증 — 반드시 이 순서로

구현만 하고 넘어가지 말고 **실제 데이터와 대조**하라. 원본의 버그는 전부 이 과정에서 나왔다.

### 10-1. 파서 (DB 없이)

```powershell
npx tsx src/scripts/verify-parser.ts
```

8개 출처 전부에서 확인할 것:
- 목록 건수 ≥ 10 (학부공지는 고정공지 포함 18건)
- 날짜·작성자가 채워지는지 — `학술·공연·행사`는 목록에 없어서 0이 정상(상세로 폴백)
- 상세: 제목 OK, 본문 글자수 > 0, 첨부 개수가 목록과 일치
- **날짜를 `toLocaleDateString("ko-KR", {timeZone:"Asia/Seoul"})`로 출력하라.**
  `toISOString()`은 하루 어긋난 것처럼 보인다

### 10-2. 수집

```powershell
npx tsx src/scripts/seed-sources.ts
npx tsx src/scripts/crawl.ts --pages 3
npx tsx src/scripts/inspect.ts
```

- 8개 출처 전부 `SUCCESS`, 합계 220건 이상
- `학술·공연·행사`의 최신 게시일이 **미래가 아닌지** (§6-1 회귀 확인)
- `originUrl`을 브라우저에서 열어 실제 공지와 제목·본문이 일치하는지 샘플 3건
- **같은 명령을 다시 실행해 `신규 0`인지** (멱등성). 갱신은 소수(본문 없는 건 재시도)만 나와야 한다

### 10-3. 규칙 기반 추출 — 원문과 직접 대조

```powershell
npx tsx src/scripts/extract-heuristics.ts --dry
```

**추출된 마감일을 원문 텍스트와 반드시 대조하라.** 최근 공지 10건 정도를 뽑아
마감 표현 주변 원문을 함께 출력하고 눈으로 확인한다. 확인 항목:
- `접수기간 A ~ B까지` 형태에서 **B**를 잡는지 (§6-3)
- 배부일·휴진일·행사 개최일에 마감이 **붙지 않는지**
- 대상학년에 교과목 개설 학년이 섞이지 않는지 (§6-4)

기대치(2026-08 기준): 마감일 약 70건, 대상학년 약 44건, 신청필요 약 172건 / 총 228건.
**마감일이 150건을 넘으면 오탐이 있다는 신호다.**

확인 후 `--dry` 없이 실행해 적용한다.

### 10-4. 추천

서로 다른 프로필로 추천이 실제로 갈리는지 확인한다:
- 1학년 / 재학 / `ACADEMIC`+`SCHOLARSHIP`
- 4학년 / 졸업예정 / `CAREER`+`INTERNSHIP`
- 대학원생 / `GRAD_RESEARCH`

각 카드의 `reasons`가 프로필과 맞아야 한다.
1학년 프로필에서 "신입생 TA" 류 공지가 상위에 오면 정상.
같은 제목이 두 번 나오면 §6-11 미적용.

### 10-5. 전체 흐름 (브라우저 또는 curl)

```
랜딩 → 학번 로그인 → 온보딩 → 목록(추천/통합) → 필터 → 검색
→ 없는 키워드 검색해 빈 결과 화면 → 상세 → 원문 링크 → 저장
→ 저장 목록 → 저장 취소 → 알림 설정 → 알림 벨에서 공지 이동
→ 프로필 수정 → 프로필 초기화 → 온보딩 재진입 → 로그아웃 → 목록 접근 시 리다이렉트
```

관리자:
```
/admin/login → 대시보드 → 출처 비활성화 → 수동 수집 → 수집 이력에 결과 표시
→ 중복 후보 검토(통합) → 통합 후 학생 목록에서 227건으로 줄고 숨긴 공지 상세는 404
→ 공지 숨김 → 해제 → 피드백 조회
```

미로그인 상태로 `/admin` 접근 시 리다이렉트(307), `/api/admin/*`는 401이어야 한다.

### 10-6. 알림

알림 기준에 키워드를 넣고 수집을 다시 실행 → 매칭 공지에 `Notification` 생성 확인.
**같은 공지로 재실행 시 0건**이어야 한다(§6-5 유니크 제약).

### 10-7. 마무리

```powershell
npx tsc --noEmit     # 에러 0
npx eslint .          # 에러 0 (§6-8 주의)
npm run build         # 성공
```

### 10-8. AI 요약 (키가 있을 때만)

```powershell
npx tsx src/scripts/enrich.ts --limit 5
```
- `summary`가 한국어 2~3문장인지
- `aiTags`가 taxonomy 키 범위 안인지
- 마감이 명시된 공지에서 `deadlineAt`이 잡히는지
- **키를 지우고 실행 → 에러 없이 안내만 출력되고, 화면은 발췌로 폴백하는지**

> 원본에서는 API 키가 없어 **AI 경로를 실제로 실행해보지 못했다.**
> 코드는 작성·타입체크됐지만 런타임 미검증이다. 키를 넣으면 반드시 `--limit 5`로 소량 먼저 확인하라.

---

## 11. 참고 파일

- `README.md` — 사용자용 실행 안내
- 원본 유저플로우: `영남대학교 화학공학부 학생을 위한 학교 공지 통합·맞춤 추천 서비스_유저플로우_2026-08-18.md`
  (n1~n58 노드 정의. §9의 대응표가 이걸 따른다)

## 12. 완성 기준

- [ ] 8개 출처에서 220건 이상 수집, 전부 `SUCCESS`
- [ ] 재수집 시 신규 0 (멱등성)
- [ ] 행사 게시판 게시일이 미래가 아님
- [ ] 마감일 약 70건 수준이고 원문 대조 시 배부일·행사일이 섞이지 않음
- [ ] 대상학년에 교과목 개설 학년이 섞이지 않음
- [ ] 프로필별로 추천이 다르고 추천 이유가 표시됨
- [ ] 추천 목록에 같은 제목이 중복되지 않음
- [ ] 유저플로우 n1~n41 전 구간 동작
- [ ] 관리자 n42~n58 전 구간 동작 + 인증 가드
- [ ] 숨긴 공지가 학생 목록·상세에서 사라짐
- [ ] 알림 중복 생성 없음
- [ ] `tsc` / `eslint` / `build` 통과
- [ ] `ANTHROPIC_API_KEY` 없이도 전체 서비스가 동작

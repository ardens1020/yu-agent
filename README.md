# 화공 공지 모아보기

영남대학교 화학공학부 학생을 위한 **학교 공지 통합·맞춤 추천 서비스**.

학부공지·학부게시판·장학안내·현장실습·취업정보·대학원공지·영대소식·학술행사 등
흩어진 게시판을 한곳에 모으고, 학년·학업상태·관심 분야에 맞춰 정렬해 보여준다.

## 빠른 시작

```bash
npm install
cp .env.local.example .env.local     # 없으면 아래 "환경변수" 참고해 직접 작성
npx prisma migrate dev               # SQLite DB 생성
npx tsx src/scripts/seed-sources.ts  # 공지 출처 8개 등록
npx tsx src/scripts/crawl.ts --pages 3   # 실제 영남대 공지 수집 (약 1~2분)
npx tsx src/scripts/extract-heuristics.ts # 마감일·대상학년 규칙 기반 추출
npm run dev                          # http://localhost:3000
```

학생 화면은 `/`에서 학번을 입력하면 시작한다(학교 포털 계정과 무관, 비밀번호 없음).
관리자 화면은 `/admin/login`, 비밀번호는 `ADMIN_PASSWORD`.

## 환경변수 (`.env.local`)

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./dev.db` |
| `SESSION_SECRET` | ✅ | 쿠키 서명 키. 배포 시 반드시 변경 |
| `ADMIN_PASSWORD` | ✅ | 관리자 로그인 비밀번호 |
| `ANTHROPIC_API_KEY` | — | 없으면 AI 요약을 건너뛰고 본문 발췌로 폴백 |
| `ANTHROPIC_MODEL` | — | 기본 `claude-opus-5` |
| `TURSO_DATABASE_URL` | 배포 시 ✅ | 있으면 `DATABASE_URL`보다 우선한다. Vercel에서는 없으면 부팅 시 에러 |
| `TURSO_AUTH_TOKEN` | 배포 시 ✅ | Turso DB 토큰 |

`prisma migrate` / CLI 스크립트는 `.env`의 `DATABASE_URL`을 읽는다(Prisma 7은 `.env`를 자동 로드하지 않아 `prisma.config.ts`에서 명시적으로 읽는다).

## 화면

| 경로 | 설명 |
|---|---|
| `/` | 랜딩. 로그인 상태면 목록 또는 온보딩으로 자동 이동 |
| `/login` | 학번 로그인 |
| `/onboarding` | 학년·학업상태·관심 분야 최초 설정 |
| `/notices` | 통합 목록 + AI 추천 + 필터·검색 |
| `/notices/[id]` | 공지 상세, 원문 링크, 저장, 피드백 |
| `/saved` | 저장한 공지 |
| `/alerts` | 알림 기준 설정 (키워드·관심분야·게시판·점수) |
| `/profile` | 프로필 조회·수정·초기화 |
| `/admin` | 관리자 대시보드 |
| `/admin/sources` | 출처 등록·수정·활성화·수동 수집 |
| `/admin/crawls` | 수집 상태·이력·오류 |
| `/admin/duplicates` | 중복 공지 검토·통합 |
| `/admin/notices` | 오류·누락 공지 확인, 숨김·수정 |
| `/admin/feedback` | 학생 피드백 조회 |

## 동작 원리

### 크롤러 — 파서 하나로 모든 게시판

영남대 전 게시판이 **동일한 CMS 엔진**을 쓴다. 확인된 규칙:

```
목록  {listPath}?mode=list&articleLimit=10&article.offset={N}
상세  {listPath}?mode=view&articleNo={articleNo}
첨부  {listPath}?mode=fileDownload&articleNo={x}&attachNo={y}
```

따라서 새 게시판을 추가하려면 `/admin/sources`에서 **경로만 등록**하면 된다.
(검증: 한 번도 분석하지 않은 신소재공학부 게시판 `/mse/master/board.do`을 등록해 즉시 수집 성공)

게시판마다 컬럼 구성이 다르므로(예: 학술·공연·행사는 작성자·작성일 컬럼이 없음)
파서는 `<thead>`의 `<th>` 라벨을 읽어 컬럼 인덱스를 매핑하고, 없는 값은 상세 페이지에서 채운다.

목록 페이지만으로 제목·작성자·날짜·조회수·첨부파일명까지 얻으므로
**상세 요청은 신규 공지의 본문을 위해서만** 보낸다. 재수집은 변경분만 갱신한다(AI 필드 보존).

### 추천 — 규칙 기반, 설명 가능

LLM 없이 결정적으로 점수를 매기므로 **추천 이유를 그대로 화면에 보여줄 수 있다**.

```
점수 = 관심 분야 키워드 매칭 (제목 3점 / 본문 1점 / AI태그 6점, 최대 40)
     + 학년 일치 25 (불일치 -15, 전체대상 8)
     + 학업 상태 우선순위 일치 15
     + 최신성 (7일 내 20, 30일 내 10, 1년 초과 -10)
     + 마감 임박 15 (지난 마감 -30)
     + 신청·제출 필요 10
     + 출처 가중치 (학부공지 14 … 영대소식 0)
```

제목이 사실상 같은 공지(재게시·복수 게시판 노출)는 추천에서 하나만 보여준다.

### 요약·추출 — AI와 규칙의 2단 구조

1. **규칙 기반 (`src/lib/extract.ts`)** — API 키 없이도 동작. 마감일·대상학년·신청필요 여부를 본문에서 뽑는다.
   - 마감일: "까지/마감/접수기간" 문맥에서만 찾고, 그 구간의 **가장 늦은** 날짜를 취한다
     ("접수기간 8.13 ~ 8.20까지" → 8/20). 행사일·휴진일·배부일은 제외한다.
   - 대상학년: **대상·자격을 명시한 문장**과 제목에서만 추출한다. 교과목 개설 학년("2학년 1학기")은 제외.
   - 거짓 마감일은 잘못된 정보를 표시하므로, 놓치더라도 확실할 때만 추출한다.
2. **AI 요약 (`src/lib/ai/`)** — `ANTHROPIC_API_KEY`가 있으면 요약·태그·마감일·대상학년을 구조화 출력으로 뽑아 규칙 결과를 덮어쓴다.

```bash
npx tsx src/scripts/enrich.ts --limit 5      # 순차 처리 (소량 확인)
npx tsx src/scripts/enrich.ts --batch        # Batches API 제출 (표준 요금의 50%)
npx tsx src/scripts/enrich.ts --status <id>  # 배치 진행 확인
npx tsx src/scripts/enrich.ts --collect <id> # 배치 결과 반영
```

### 중복 탐지

제목을 정규화(대괄호 태그·특수문자 제거)해 완전일치 또는 토큰 Jaccard ≥ 0.75인 쌍을
**서로 다른 출처**끼리만 후보로 올린다. 관리자가 통합(한쪽 숨김) 또는 별개로 확정한다.

### 알림

수집 후 알림 기준(키워드 / 관심 분야 / 게시판 / 추천 점수)에 맞는 공지로 `Notification`을 만든다.
헤더의 알림 벨에서 확인하고 공지로 이동한다. `(userId, noticeId)` 유니크 제약으로 중복 알림을 막는다.
**웹 내 알림만 지원한다** — 이메일·푸시는 범위 밖.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npx tsx src/scripts/seed-sources.ts` | 출처 8개 등록/갱신 |
| `npx tsx src/scripts/crawl.ts [--pages N] [--source <경로\|이름>]` | 수집 + 중복 탐지 + 알림 |
| `npx tsx src/scripts/extract-heuristics.ts [--dry]` | 규칙 기반 추출 (AI 미적용 공지) |
| `npx tsx src/scripts/enrich.ts` | AI 요약 (위 참고) |
| `npx tsx src/scripts/verify-parser.ts` | DB 없이 파서 동작 확인 |
| `npx tsx src/scripts/inspect.ts` | 수집 결과 점검 |
| `npx tsx src/scripts/recrawl-source.ts --source <경로>` | 특정 출처 삭제 후 재수집 (파서 수정 후) |

## 배포 (Vercel + Turso)

서버리스 파일시스템은 휘발성이라 SQLite 파일을 쓸 수 없다. 배포에서는 같은 SQLite를
**Turso**(libSQL)에 올려 쓴다. 어댑터는 `@prisma/adapter-libsql` 하나로 로컬 파일과
Turso를 모두 처리하므로 코드 변경은 없다 (`src/lib/db.ts`).

### 1. 로컬에서 DB를 먼저 완성한다

위 "빠른 시작"을 그대로 실행해 `dev.db`에 출처·공지가 들어간 상태를 만든다.
Turso DB는 이 파일을 그대로 복제해 만드는 게 가장 쉽다.

### 2. Turso DB 만들기 (본인 계정)

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # Windows는 scoop install turso
turso auth signup            # 또는 turso auth login
turso db create yu-agent --from-file dev.db
turso db show yu-agent --url         # → TURSO_DATABASE_URL
turso db tokens create yu-agent      # → TURSO_AUTH_TOKEN
```

이미 빈 DB를 만들어버렸다면 `--from-file`을 다시 쓸 수 없다.
그때만 `.env.local`에 위 두 값을 넣고 `npx tsx src/scripts/push-to-turso.ts`로 옮긴다.

### 3. Vercel 배포 (본인 계정)

`.vercel/`은 gitignore 대상이라 저장소에 없다. 각자 자기 계정으로 새로 연결한다.

1. GitHub에 저장소를 올리고 [vercel.com/new](https://vercel.com/new)에서 import (Framework: Next.js, 설정 그대로).
2. Environment Variables에 등록 — `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `SESSION_SECRET`, `ADMIN_PASSWORD`, (선택) `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
   `DATABASE_URL`은 넣지 않는다.
3. Deploy. 리전은 `vercel.json`에서 서울(`icn1`)로 고정돼 있다.

CLI로 하려면 `npm i -g vercel && vercel link && vercel --prod`.

### 4. 배포 후 공지 수집

- 관리자 화면 `/admin/sources`의 "수동 수집" — 게시판 1~2개씩. 서버리스 실행 시간 제한이
  있어 전체 수집은 타임아웃될 수 있다.
- 권장: `.env.local`에 `TURSO_*`를 채우고 **로컬에서** 스크립트를 돌린다.
  `db.ts`가 `TURSO_DATABASE_URL`을 우선하므로 그대로 운영 DB에 쓰인다.

  ```bash
  npx tsx src/scripts/crawl.ts --pages 2
  npx tsx src/scripts/extract-heuristics.ts
  npx tsx src/scripts/enrich.ts --batch    # AI 요약 (API 키 필요)
  ```

  이때 `npm run dev`도 Turso를 보게 된다. 로컬 DB로 돌아가려면 두 변수를 다시 주석 처리한다.

### 5. 스키마를 바꿨을 때 — Turso에 마이그레이션 적용

**`prisma migrate`는 Turso를 대상으로 쓸 수 없다.** `DATABASE_URL`에 `libsql://`을 넣으면
`P1013: The scheme is not recognized`로 끊긴다(Prisma 7.9의 sqlite provider는 `file:`만 받는다).
그래서 순서가 이렇다:

```bash
npx prisma migrate dev --name <이름>                       # 1. 로컬 dev.db에 적용
turso db shell <db> < prisma/migrations/<새폴더>/migration.sql   # 2. Turso에 같은 SQL 적용
```

2번 뒤 `_prisma_migrations`에 기록을 남기지 않아도 된다 — Prisma CLI가 Turso에 붙지 못하므로
그 표를 읽는 쪽이 없다. **로컬과 Turso에 같은 SQL을 반드시 둘 다 적용해야 한다.** 한쪽만 하면
배포 화면에서 `no such column` 류로 터진다.

컬럼 추가·인덱스 정도는 위로 충분하다. 데이터 이동이 필요한 큰 변경이면 `dev.db`에서 새로 만들어
`push-to-turso.ts`로 옮기는 편이 안전하다(운영 데이터를 덮어쓰니 사용자·저장 공지는 백업해야 한다).

### 6. 배포 후 자주 막히는 것

| 증상 | 원인·해결 |
|---|---|
| 배포 후 모든 페이지가 500 | `TURSO_DATABASE_URL`이 비었다. `db.ts`가 일부러 즉시 던진다 — 조용히 빈 DB를 쓰는 것보다 낫다. Vercel 환경변수 등록 후 **재배포**(환경변수 변경은 자동 반영되지 않는다) |
| 로컬은 되는데 배포만 데이터가 없음 | 로컬은 `dev.db`, 배포는 Turso다. 수집 스크립트를 `TURSO_*` 채운 상태로 다시 돌린다 |
| `no such column` / `no such table` | 위 §5의 2번을 빠뜨렸다 |
| 배포 후 전원 재로그인 | `SESSION_SECRET`을 바꾸면 기존 서명 쿠키가 전부 무효다. 정상이다 |
| 공지가 며칠째 그대로 | **자동 수집이 없다.** 사람이 `crawl.ts`를 돌리거나 관리자 화면에서 수동 수집한다. 자동화하려면 `vercel.json`에 `crons`를 추가하고 출처별로 나눠 호출한다(한 번에 전체는 타임아웃) |
| 관리자 로그인이 안 됨 | Vercel의 `ADMIN_PASSWORD`는 로컬 `.env.local`과 별개다 |
| Turso 용량·요청 한도 | 무료 플랜 한도는 [Turso 콘솔](https://turso.tech)에서 확인한다. 이 앱은 공지 수천 건 규모라 여유롭다 |

## 인수인계 체크리스트

- [ ] 저장소 접근 — GitHub Collaborator 초대(Settings → Collaborators) 또는 fork
- [ ] `npm install` → `npx prisma migrate dev` → `npm run dev`로 로컬 실행 확인
- [ ] `SESSION_SECRET`, `ADMIN_PASSWORD`는 새 값으로 생성 (이전 값 재사용 금지)
- [ ] `ANTHROPIC_API_KEY`는 본인 [콘솔](https://console.anthropic.com) 키 발급 (없어도 동작)
- [ ] Turso DB·Vercel 프로젝트를 본인 계정으로 새로 생성 (위 배포 절차)
- [ ] 이전 배포는 필요 없어지면 삭제, 이전 Turso 토큰은 `turso db tokens invalidate`로 폐기
- [ ] `REBUILD.md`의 "절대 다시 만들면 안 되는 버그" 절 읽기 — 실제 데이터로 잡은 버그 목록

## 문서

| 파일 | 용도 |
|---|---|
| `README.md` | 실행·환경변수·동작 원리·배포 |
| `REBUILD.md` | 코드 없이 처음부터 다시 만들 때의 지침 (데이터 모델·CMS 구조·재발 금지 버그) |
| `UI.md` | 화면 스펙 — 디자인 토큰·공통 컴포넌트 원본 코드·화면별 문구 |

`REBUILD.md` + `UI.md`만 있으면 코드 없이도 같은 서비스를 다시 만들 수 있게 유지한다.
**코드를 고치고 화면 문구나 공통 컴포넌트가 바뀌면 `UI.md`도 같이 고쳐라** — 안 그러면 두 문서가 거짓말을 한다.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 + SQLite/libSQL (`@prisma/adapter-libsql` — 로컬 파일과 Turso 공용) · cheerio · Anthropic SDK

## 알아둘 점

- **비공식 프로젝트**다. 모든 공지의 원문은 영남대학교 공식 게시판에 있고, 상세 화면의 "원문 보기"로 이동한다.
- 로그인은 **학번 입력만** 받는다(데모용). 실제 학교 포털 SSO 연동은 하지 않는다.
- 마감일·대상학년은 본문에서 **추정한 값**이다. 중요한 일정은 원문을 확인해야 한다.
- 자동 스케줄 수집은 없다. 수동 실행(`crawl.ts` 또는 관리자 화면)만 지원하며,
  `CrawlRun.trigger` 필드는 이후 cron 연동을 위해 준비돼 있다.
- 첨부파일(PDF·HWP) 내용은 파싱하지 않는다. 파일명과 링크만 제공한다.

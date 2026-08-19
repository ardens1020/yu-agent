/**
 * 공지 출처 정의.
 *
 * 두 종류의 시스템에서 수집한다:
 *  1. 영남대 `.do` CMS (www.yu.ac.kr) — 전 게시판이 같은 엔진이라 파서 하나로 처리한다.
 *  2. 학생성공처 (join.yu.ac.kr) — PHP 기반 별개 시스템. 목록은 공개, 상세는 로그인 필요.
 *     상세를 받지 못하는 대신 목록이 기업명·접수기한·모집상태를 구조화 필드로 준다.
 */
export const YU_ORIGIN = "https://www.yu.ac.kr";
export const JOIN_ORIGIN = "https://join.yu.ac.kr";

export interface SourceSeed {
  name: string;
  siteId: string;
  boardNo: string;
  listPath: string;
  category: string;
  sortOrder: number;
  adapter: string;
  origin: string;
  /** 전집 수집 시 최대 페이지 수 (목록 페이지 기준) */
  deepPages: number;
}

const doBoard = (
  name: string,
  listPath: string,
  boardNo: string,
  category: string,
  sortOrder: number,
  deepPages: number,
): SourceSeed => ({
  name,
  siteId: listPath.split("/")[1] ?? "main",
  boardNo,
  listPath,
  category,
  sortOrder,
  adapter: "YU_BOARD",
  origin: YU_ORIGIN,
  deepPages,
});

export const SOURCE_SEEDS: SourceSeed[] = [
  // ── 영남대 .do CMS ──────────────────────────────────────
  // deepPages는 실측 총 게시물 수 기준 (학부공지 2,829건 → 283페이지)
  doBoard("화공 학부공지", "/che/notice/notice.do", "251", "DEPT", 1, 290),
  doBoard("화공 학부게시판(선수강지도)", "/che/notice/bulletin-board.do", "253", "DEPT", 2, 60),
  doBoard("화공 장학안내", "/che/notice/scholarship-guidance.do", "1947", "SCHOLARSHIP", 3, 5),
  doBoard("화공 현장실습공지", "/che/notice/field-training-announcement.do", "1948", "INTERNSHIP", 4, 40),
  doBoard("화공 취업정보", "/che/notice/employment.do", "254", "CAREER", 5, 80),
  doBoard("화공 대학원공지", "/che/notice/graduate-school-announcement.do", "671", "GRAD", 6, 40),
  // 영대소식은 10,949건이라 전집은 과하다. 최신 3년 ≈ 300페이지.
  doBoard("영대소식(학교 전체)", "/main/intro/yu-news.do", "5", "UNIV", 7, 300),
  doBoard("학술·공연·행사", "/main/intro/academic-performance-and-event.do", "34", "EVENT", 8, 40),

  // ── 학생성공처 (join.yu.ac.kr) ──────────────────────────
  {
    name: "학생성공처 기업 채용정보",
    siteId: "join",
    boardNo: "job01",
    listPath: "/front_new/index.php?g_page=job&m_page=job01&view_key=all",
    category: "CAREER",
    sortOrder: 9,
    adapter: "JOIN_JOB",
    origin: JOIN_ORIGIN,
    // 현재 모집중인 것만 노출된다(약 2~3페이지).
    deepPages: 10,
  },
  {
    name: "학생성공처 교내 추천채용",
    siteId: "join",
    boardNo: "job02",
    listPath: "/front_new/index.php?g_page=job&m_page=job02",
    category: "CAREER",
    sortOrder: 10,
    adapter: "JOIN_JOB",
    origin: JOIN_ORIGIN,
    deepPages: 10,
  },
  {
    name: "학생성공처 진로취업 프로그램",
    siteId: "join",
    boardNo: "program01",
    listPath: "/front_new/index.php?g_page=program&m_page=program01",
    category: "PROGRAM",
    sortOrder: 11,
    adapter: "JOIN_PROGRAM",
    origin: JOIN_ORIGIN,
    // 종료분이 43페이지. 주기 분석의 핵심 데이터다.
    deepPages: 50,
  },
];

/** 출처 어댑터 공통 타입. 영남대 `.do` CMS와 학생성공처(join)는 구조가 완전히 다르다. */

export interface Attachment {
  name: string;
  url: string;
}

/** 채용·프로그램 공고에서만 채워지는 구조화 정보 */
export interface StructuredFields {
  /** 모집분야 / 과목 / 급여 / 근무형태 */
  positionField?: string;
  /** 모집전공 · 지원자격 · 학력 */
  eligibility?: string;
  /** 근무 지역 */
  region?: string;
  /** 모집인원 */
  capacity?: string;
  /** 접수 시작일 (문자열 원본 보존) */
  applyPeriodRaw?: string;
  /** 프로그램 일자 원본 */
  eventPeriodRaw?: string;
}

/** 어댑터가 목록에서 뽑아내는 한 건 */
export interface ParsedItem {
  /** 출처 내 고유 ID — .do는 articleNo, join은 idx/P_IDX */
  externalId: string;
  title: string;
  writer: string | null;
  /** 게시일. join 프로그램처럼 게시일이 없으면 접수 시작일이나 프로그램 시작일로 대체한다. */
  publishedAt: Date | null;
  views: number;
  isPinned: boolean;
  attachments: Attachment[];
  /** 학생이 원문을 볼 수 있는 절대 URL */
  originUrl: string;

  /** 구조화 필드가 있는 출처만 채운다 */
  company?: string | null;
  recruitStatus?: string | null;
  /** 정확한 마감일 (구조화 필드에서 얻은 경우) */
  deadlineAt?: Date | null;
  eventStart?: Date | null;
  eventEnd?: Date | null;
  structured?: StructuredFields;
}

export interface ParsedDetail {
  title: string | null;
  writer: string | null;
  publishedAt: Date | null;
  views: number | null;
  contentHtml: string;
  contentText: string;
  attachments: Attachment[];
}

/** 어댑터가 받는 출처 정보 (Prisma Source의 부분집합) */
export interface SourceRef {
  origin: string;
  listPath: string;
  category: string;
}

export interface FetchListOptions {
  pages?: number;
  limit?: number;
  delayMs?: number;
}

export interface CrawlAdapter {
  key: string;
  fetchList(source: SourceRef, options?: FetchListOptions): Promise<ParsedItem[]>;
  /** 상세를 받을 수 없는 출처(예: join — 로그인 필요)는 구현하지 않는다. */
  fetchDetail?(source: SourceRef, externalId: string): Promise<ParsedDetail>;
  /** 한 페이지에 담기는 항목 수 (페이지네이션 계산용) */
  pageSize: number;
}

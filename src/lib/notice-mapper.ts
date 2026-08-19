import { parseJsonArray } from "./db";
import type { Attachment } from "./crawler/adapters/types";
import type { ScorableNotice } from "./recommend";

/** DB의 Notice(JSON 필드가 문자열)를 앱에서 쓰는 형태로 변환한다. */
export interface RawNotice {
  id: string;
  title: string;
  writer: string | null;
  publishedAt: Date;
  views: number;
  contentText: string | null;
  contentHtml?: string | null;
  originUrl: string;
  attachments: string;
  aiTags: string;
  targetGrades: string;
  deadlineAt: Date | null;
  actionRequired: boolean;
  summary: string | null;
  isPinned: boolean;
  isHidden?: boolean;
  adminNote?: string | null;
  sourceId: string;
  source?: { id: string; name: string; category: string } | null;
}

export interface NoticeView {
  id: string;
  title: string;
  writer: string | null;
  publishedAt: string;
  views: number;
  originUrl: string;
  summary: string | null;
  excerpt: string;
  attachments: Attachment[];
  aiTags: string[];
  targetGrades: number[];
  deadlineAt: string | null;
  actionRequired: boolean;
  isPinned: boolean;
  sourceId: string;
  sourceName: string;
  sourceCategory: string;
}

export function noticeToScorable(notice: RawNotice): ScorableNotice {
  return {
    id: notice.id,
    title: notice.title,
    contentText: notice.contentText,
    publishedAt: notice.publishedAt,
    deadlineAt: notice.deadlineAt,
    targetGrades: parseJsonArray<number>(notice.targetGrades),
    aiTags: parseJsonArray<string>(notice.aiTags),
    actionRequired: notice.actionRequired,
    sourceCategory: notice.source?.category ?? "UNIV",
  };
}

/** AI 요약이 없을 때 쓰는 본문 발췌 (API 키 없이도 서비스가 동작하도록) */
export function buildExcerpt(contentText: string | null, length = 160): string {
  if (!contentText) return "";
  const flat = contentText.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

export function toNoticeView(notice: RawNotice): NoticeView {
  return {
    id: notice.id,
    title: notice.title,
    writer: notice.writer,
    publishedAt: notice.publishedAt.toISOString(),
    views: notice.views,
    originUrl: notice.originUrl,
    summary: notice.summary,
    excerpt: buildExcerpt(notice.contentText),
    attachments: parseJsonArray<Attachment>(notice.attachments),
    aiTags: parseJsonArray<string>(notice.aiTags),
    targetGrades: parseJsonArray<number>(notice.targetGrades),
    deadlineAt: notice.deadlineAt?.toISOString() ?? null,
    actionRequired: notice.actionRequired,
    isPinned: notice.isPinned,
    sourceId: notice.sourceId,
    sourceName: notice.source?.name ?? "",
    sourceCategory: notice.source?.category ?? "UNIV",
  };
}

/**
 * 공지 본문 HTML을 화면에 렌더링하기 위해 정리한다.
 * - 상대 경로 이미지/링크를 영남대 절대 URL로 바꾼다 (본문이 이미지뿐인 공지가 실제로 있다)
 * - script/iframe 등 실행 가능한 태그와 이벤트 핸들러를 제거한다
 * - 원문 인라인 스타일(고정 폰트·색)을 제거해 다크 모드에서도 읽히게 한다
 */
export function sanitizeNoticeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*(script|iframe|object|embed|form|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "")
    .replace(/(\s(?:src|href)\s*=\s*")\/(?!\/)/gi, "$1https://www.yu.ac.kr/")
    .replace(/(\s(?:src|href)\s*=\s*')\/(?!\/)/gi, "$1https://www.yu.ac.kr/");
}

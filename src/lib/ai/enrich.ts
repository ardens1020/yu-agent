import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, getAnthropic } from "./client";
import { prisma, toJson } from "@/lib/db";
import { INTERESTS } from "@/lib/taxonomy";

const INTEREST_KEYS = INTERESTS.map((i) => i.key);

export const NoticeEnrichment = z.object({
  summary: z
    .string()
    .describe("공지 핵심을 한국어 2~3문장으로 요약. 누가/무엇을/언제까지 하면 되는지 위주."),
  tags: z
    .array(z.enum(INTEREST_KEYS as [string, ...string[]]))
    .describe("해당하는 관심 분야 키. 없으면 빈 배열."),
  deadline: z
    .string()
    .nullable()
    .describe("신청·제출 마감일이 명시돼 있으면 YYYY-MM-DD, 없으면 null."),
  targetGrades: z
    .array(z.number().int().min(1).max(5))
    .describe("특정 학년만 대상이면 그 학년들. 전체 대상이거나 불명확하면 빈 배열."),
  actionRequired: z
    .boolean()
    .describe("학생이 직접 신청·제출·등록해야 하는 공지인지. 단순 안내면 false."),
});

export type NoticeEnrichmentResult = z.infer<typeof NoticeEnrichment>;

const SYSTEM = `너는 영남대학교 화학공학부 학생들이 보는 학교 공지를 정리하는 도우미다.

각 공지에서 학생이 실제로 알아야 할 것만 뽑아낸다.
- summary: 한국어 2~3문장. 대상, 해야 할 일, 기한을 우선 담는다. 원문에 없는 내용을 추측해 넣지 않는다.
- tags: 아래 목록에서만 고른다. 여러 개 가능하고, 애매하면 넣지 않는다.
${INTERESTS.map((i) => `  ${i.key} = ${i.label} (${i.description})`).join("\n")}
- deadline: 신청·제출·접수 마감일이 본문에 명시된 경우만 YYYY-MM-DD로. "8/29(금)"처럼 연도가 없으면 게시일 연도를 기준으로 추론한다. 행사 개최일은 마감일이 아니다.
- targetGrades: "3학년 이상", "전학년" 같은 표현을 해석한다. 전학년/불명확은 빈 배열.
- actionRequired: 학생이 직접 서류를 내거나 신청해야 하면 true, 단순 정보 안내면 false.

본문이 비어 있거나 "첨부파일 참고" 수준이면 제목만으로 판단하고, summary에 본문이 첨부로만 안내된다는 점을 적는다.`;

export interface EnrichInput {
  id: string;
  title: string;
  contentText: string | null;
  sourceName: string;
  publishedAt: Date;
}

/** 공지 한 건을 요약·분류한다. AI를 쓸 수 없으면 null. */
export async function enrichNotice(input: EnrichInput): Promise<NoticeEnrichmentResult | null> {
  const client = getAnthropic();
  if (!client) return null;

  const body = (input.contentText ?? "").slice(0, 8000);
  const userContent = [
    `출처: ${input.sourceName}`,
    `게시일: ${input.publishedAt.toISOString().slice(0, 10)}`,
    `제목: ${input.title}`,
    "",
    body ? `본문:\n${body}` : "본문: (없음 — 첨부파일이나 이미지로만 안내된 공지)",
  ].join("\n");

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    // 요약·분류는 깊은 추론이 필요 없다.
    output_config: { effort: "low", format: zodOutputFormat(NoticeEnrichment) },
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}

/** 요약 결과를 DB에 반영한다. */
export async function saveEnrichment(
  noticeId: string,
  result: NoticeEnrichmentResult,
  publishedAt: Date,
): Promise<void> {
  await prisma.notice.update({
    where: { id: noticeId },
    data: {
      summary: result.summary.trim() || null,
      aiTags: toJson(result.tags),
      targetGrades: toJson(result.targetGrades),
      actionRequired: result.actionRequired,
      deadlineAt: parseDeadline(result.deadline, publishedAt),
      enrichedAt: new Date(),
    },
  });
}

/** 마감일 문자열을 KST 기준 Date로. 게시일보다 1년 이상 이전이면 잘못 뽑은 것으로 보고 버린다. */
export function parseDeadline(raw: string | null, publishedAt: Date): Date | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T23:59:59+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  const yearBefore = publishedAt.getTime() - 365 * 24 * 60 * 60 * 1000;
  if (date.getTime() < yearBefore) return null;
  return date;
}

/** 아직 요약되지 않은 공지를 순차 처리한다 (소량 처리·재시도용). */
export async function enrichPending({ limit = 20 } = {}): Promise<{
  processed: number;
  failed: number;
  skipped: boolean;
}> {
  if (!getAnthropic()) return { processed: 0, failed: 0, skipped: true };

  const rows = await prisma.notice.findMany({
    where: { enrichedAt: null, isHidden: false },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      contentText: true,
      publishedAt: true,
      source: { select: { name: true } },
    },
  });

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const result = await enrichNotice({
        id: row.id,
        title: row.title,
        contentText: row.contentText,
        sourceName: row.source.name,
        publishedAt: row.publishedAt,
      });
      if (result) {
        await saveEnrichment(row.id, result, row.publishedAt);
        processed += 1;
      } else {
        failed += 1;
      }
    } catch {
      // 개별 공지 실패는 전체를 멈추지 않는다.
      failed += 1;
    }
  }
  return { processed, failed, skipped: false };
}

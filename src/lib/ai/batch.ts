import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, getAnthropic } from "./client";
import { prisma } from "@/lib/db";
import { NoticeEnrichment, saveEnrichment, type NoticeEnrichmentResult } from "./enrich";
import { INTERESTS } from "@/lib/taxonomy";

/**
 * 초기 시드(수백 건) 요약은 Message Batches API로 처리한다 — 표준 요금의 50%.
 * custom_id에 Notice.id를 넣어 결과를 되돌려 매핑한다(결과 순서는 보장되지 않음).
 */
const SYSTEM = `너는 영남대학교 화학공학부 학생들이 보는 학교 공지를 정리하는 도우미다.

각 공지에서 학생이 실제로 알아야 할 것만 뽑아낸다.
- summary: 한국어 2~3문장. 대상, 해야 할 일, 기한을 우선 담는다. 원문에 없는 내용을 추측해 넣지 않는다.
- tags: 아래 목록에서만 고른다. 여러 개 가능하고, 애매하면 넣지 않는다.
${INTERESTS.map((i) => `  ${i.key} = ${i.label} (${i.description})`).join("\n")}
- deadline: 신청·제출·접수 마감일이 본문에 명시된 경우만 YYYY-MM-DD로. 연도가 없으면 게시일 연도를 기준으로 추론한다. 행사 개최일은 마감일이 아니다.
- targetGrades: "3학년 이상", "전학년" 같은 표현을 해석한다. 전학년/불명확은 빈 배열.
- actionRequired: 학생이 직접 서류를 내거나 신청해야 하면 true, 단순 정보 안내면 false.

본문이 비어 있거나 "첨부파일 참고" 수준이면 제목만으로 판단하고, summary에 본문이 첨부로만 안내된다는 점을 적는다.`;

export interface BatchSubmitResult {
  batchId: string | null;
  requested: number;
  skipped: boolean;
}

export async function submitEnrichmentBatch({ limit = 300 } = {}): Promise<BatchSubmitResult> {
  const client = getAnthropic();
  if (!client) return { batchId: null, requested: 0, skipped: true };

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
  if (rows.length === 0) return { batchId: null, requested: 0, skipped: false };

  const format = zodOutputFormat(NoticeEnrichment);

  const batch = await client.messages.batches.create({
    requests: rows.map((row) => ({
      custom_id: row.id,
      params: {
        model: AI_MODEL,
        max_tokens: 2048,
        system: SYSTEM,
        output_config: { effort: "low", format },
        messages: [
          {
            role: "user" as const,
            content: [
              `출처: ${row.source.name}`,
              `게시일: ${row.publishedAt.toISOString().slice(0, 10)}`,
              `제목: ${row.title}`,
              "",
              row.contentText
                ? `본문:\n${row.contentText.slice(0, 8000)}`
                : "본문: (없음 — 첨부파일이나 이미지로만 안내된 공지)",
            ].join("\n"),
          },
        ],
      },
    })),
  });

  return { batchId: batch.id, requested: rows.length, skipped: false };
}

export async function getBatchStatus(batchId: string) {
  const client = getAnthropic();
  if (!client) return null;
  const batch = await client.messages.batches.retrieve(batchId);
  return { status: batch.processing_status, counts: batch.request_counts };
}

export interface BatchCollectResult {
  succeeded: number;
  failed: number;
  parseFailed: number;
}

/** 완료된 배치 결과를 DB에 반영한다. */
export async function collectEnrichmentBatch(batchId: string): Promise<BatchCollectResult> {
  const client = getAnthropic();
  if (!client) return { succeeded: 0, failed: 0, parseFailed: 0 };

  const publishedAtById = new Map(
    (
      await prisma.notice.findMany({
        where: { enrichedAt: null },
        select: { id: true, publishedAt: true },
      })
    ).map((n) => [n.id, n.publishedAt]),
  );

  let succeeded = 0;
  let failed = 0;
  let parseFailed = 0;

  for await (const entry of await client.messages.batches.results(batchId)) {
    if (entry.result.type !== "succeeded") {
      failed += 1;
      continue;
    }
    const publishedAt = publishedAtById.get(entry.custom_id);
    if (!publishedAt) continue; // 이미 처리됐거나 삭제된 공지

    const text = entry.result.message.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") {
      parseFailed += 1;
      continue;
    }
    try {
      const parsed = NoticeEnrichment.parse(JSON.parse(text.text)) as NoticeEnrichmentResult;
      await saveEnrichment(entry.custom_id, parsed, publishedAt);
      succeeded += 1;
    } catch {
      parseFailed += 1;
    }
  }

  return { succeeded, failed, parseFailed };
}

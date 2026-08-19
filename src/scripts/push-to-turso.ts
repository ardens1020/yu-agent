/**
 * 로컬 dev.db를 Turso로 옮긴다 (스키마 + 전체 데이터).
 *   npx tsx src/scripts/push-to-turso.ts
 * .env.local에 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN이 있어야 한다.
 *
 * `turso db create --from-file dev.db`를 못 쓴 경우(빈 DB를 이미 만들어버린 경우)의 대체 경로다.
 * sqlite3 `.dump`는 쓰지 않는다 — sqlite 3.49+ 가 제어문자를 `unistr()`로 감싸는데
 * libsql 엔진에 그 함수가 없어 그대로는 적재되지 않는다. 값은 전부 파라미터로 바인딩한다.
 */
import "../lib/load-env";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client, type InStatement } from "@libsql/client";

const targetUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!targetUrl || !authToken) {
  throw new Error(".env.local에 TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN을 넣어라.");
}

/** 세미콜론으로 문장을 자른다. 홑따옴표가 짝수여야 문자열이 닫힌 것이다(sqlite는 '' 로 이스케이프). */
function statements(sql: string): string[] {
  const out: string[] = [];
  let buffer = "";
  let quotes = 0;
  for (const line of sql.split("\n")) {
    if (/^\s*--/.test(line) && quotes % 2 === 0) continue;
    buffer += (buffer ? "\n" : "") + line;
    quotes += (line.match(/'/g) ?? []).length;
    if (quotes % 2 === 0 && buffer.trimEnd().endsWith(";")) {
      out.push(buffer.trim());
      buffer = "";
      quotes = 0;
    }
  }
  return out;
}

/** FK를 끈 채 실행한다 — 테이블 생성 순서와 FK 참조 순서가 어긋나도 상관없게. */
async function run(client: Client, stmts: InStatement[], label: string) {
  for (let i = 0; i < stmts.length; i += 200) {
    await client.migrate(stmts.slice(i, i + 200));
    process.stdout.write(`\r${label} ${Math.min(i + 200, stmts.length)}/${stmts.length}`);
  }
  if (stmts.length) process.stdout.write("\n");
}

async function main() {
  const source = createClient({ url: "file:dev.db" });
  const target = createClient({ url: targetUrl!, authToken });

  const existing = await target.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  if (Number(existing.rows[0].n) > 0) {
    throw new Error(`대상 DB에 이미 테이블이 ${existing.rows[0].n}개 있다. 덮어쓰지 않는다.`);
  }

  // 1. 스키마 — 마이그레이션 SQL을 순서대로 적용한다.
  const dir = path.join("prisma", "migrations");
  const schema = readdirSync(dir)
    .filter((name) => !name.endsWith(".toml"))
    .sort()
    .flatMap((name) => statements(readFileSync(path.join(dir, name, "migration.sql"), "utf8")));
  await run(target, schema, "스키마");

  // 2. 마이그레이션 SQL이 만들지 않는 테이블(_prisma_migrations)은 로컬 DDL을 그대로 옮긴다.
  //    이 테이블이 있어야 이후 `prisma migrate deploy`가 두 마이그레이션을 재적용하지 않는다.
  const tables = await source.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const present = new Set(
    (await target.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(
      (r) => r.name as string,
    ),
  );
  await run(
    target,
    (tables.rows as unknown as { name: string; sql: string }[])
      .filter((t) => !present.has(t.name))
      .map((t) => t.sql),
    "누락 테이블",
  );

  // 3. 데이터 — 값은 전부 바인딩한다.
  for (const { name } of tables.rows as unknown as { name: string }[]) {
    const rows = await source.execute(`SELECT * FROM "${name}"`);
    if (!rows.rows.length) continue;
    const columns = rows.columns;
    const sql = `INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
    await run(
      target,
      rows.rows.map((row) => ({ sql, args: columns.map((c) => row[c]) })),
      `${name} ${rows.rows.length}행`,
    );
  }

  const notices = await target.execute("SELECT count(*) AS n FROM Notice");
  const sources = await target.execute("SELECT count(*) AS n FROM Source");
  console.log(`완료 — 출처 ${sources.rows[0].n}건, 공지 ${notices.rows[0].n}건`);
  source.close();
  target.close();
}

main();

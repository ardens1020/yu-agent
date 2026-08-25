/**
 * Turso에 마이그레이션을 적용한다: npx tsx src/scripts/migrate-turso.ts [--dry]
 *
 * `prisma migrate deploy`는 libsql:// 를 대상으로 쓸 수 없고, `turso db shell`은
 * Turso CLI 설치가 필요하다. 이 스크립트는 @libsql/client로 직접 붙어서
 * `_prisma_migrations`에 없는 마이그레이션만 순서대로 적용하고 기록을 남긴다.
 *
 * 접속 정보는 환경변수에서 읽는다 (.env.local에 넣어두면 된다):
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */
import "../lib/load-env";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const dry = process.argv.includes("--dry");
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  throw new Error("TURSO_DATABASE_URL이 libsql:// 주소여야 한다. (.env.local 확인)");
}
if (!authToken) throw new Error("TURSO_AUTH_TOKEN이 없다. (.env.local 확인)");

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

async function main() {
  const dir = path.join("prisma", "migrations");
  const all = readdirSync(dir)
    .filter((name) => !name.endsWith(".toml"))
    .sort();

  const client = createClient({ url: url!, authToken });

  const applied = new Set(
    (await client.execute("SELECT migration_name FROM _prisma_migrations")).rows.map(
      (r) => r.migration_name as string,
    ),
  );
  const pending = all.filter((name) => !applied.has(name));

  console.log(`마이그레이션 ${all.length}개 · 적용됨 ${applied.size}개 · 대기 ${pending.length}개`);
  if (pending.length === 0) {
    console.log("적용할 것이 없다.");
    client.close();
    return;
  }
  for (const name of pending) console.log(`  대기: ${name}`);
  if (dry) {
    console.log("\n(dry run — 적용하지 않음)");
    client.close();
    return;
  }

  for (const name of pending) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    const stmts = statements(sql);
    // migrate()는 FK를 끈 채 실행한다. Prisma의 SQLite 마이그레이션은 테이블을 재생성하며
    // PRAGMA foreign_keys를 직접 조작하는데, 트랜잭션 안에서는 그 PRAGMA가 무시된다.
    await client.migrate(stmts);
    await client.execute({
      sql: `INSERT INTO _prisma_migrations
              (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
            VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
      args: [
        randomUUID(),
        createHash("sha256").update(sql).digest("hex"),
        Date.now(),
        name,
        Date.now(),
        stmts.length,
      ],
    });
    console.log(`  ✓ ${name} (${stmts.length}문장)`);
  }

  console.log("\n완료");
  client.close();
}

main();

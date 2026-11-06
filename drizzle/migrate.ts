import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inDollar = false;
  let inSingle = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (!inSingle && sql.startsWith("$$", i)) {
      inDollar = !inDollar;
      buf += "$$";
      i += 2;
      continue;
    }
    if (!inDollar && !inSingle && sql.startsWith("--", i)) {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (!inDollar && ch === "'") {
      if (inSingle && sql[i + 1] === "'") {
        buf += "''";
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      buf += ch;
      i += 1;
      continue;
    }
    if (!inDollar && !inSingle && ch === ";") {
      const s = buf.trim();
      if (s.length) out.push(s);
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  const rest = buf.trim();
  if (rest.length) out.push(rest);
  return out.filter((stmt) => stmt.trim().length > 0);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url);
  const dir = join(process.cwd(), "lib/db/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    const statements = splitSql(raw);
    console.log(`Applying ${file} (${statements.length} statements)...`);
    for (const stmt of statements) {
      try {
        await sql.query(stmt);
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e.code === "42P07" || e.code === "42710" || e.message?.includes("already exists")) {
          continue;
        }
        if (e.code === "42P17") {
          console.warn("Skip non-immutable index:", stmt.slice(0, 80).replace(/\s+/g, " "));
          continue;
        }
        console.error("Failed statement:\n", stmt.slice(0, 400));
        throw err;
      }
    }
    console.log(`OK ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

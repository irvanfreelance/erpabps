import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const all = readFileSync("lib/db/migrations/0000_init.sql", "utf8");
  const start = all.indexOf("CREATE OR REPLACE FUNCTION fn_rebuild_search_index");
  const end = all.indexOf("CREATE OR REPLACE FUNCTION fn_recalculate_rfm");
  const fn = all.slice(start, end).trim().replace(/;$/, "");
  await sql.query(fn);
  console.log("fn_rebuild_search_index replaced");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

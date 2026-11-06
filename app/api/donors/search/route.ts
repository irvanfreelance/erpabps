import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";
import { searchSchema } from "@/lib/validators/donor";

const CORE_SEARCH_FIELDS = new Set([
  "nama",
  "no_hp",
  "email",
  "status",
  "segmen",
  "follow_up_status",
  "last_donation_date",
  "assigned_to_id",
]);

function dynCompareSql(op: string, pSlug: string, pVal: string, pBool: string, pJson: string, pNum: string, pDate: string) {
  const textExpr = `COALESCE(ddf.value_text, ddf.value_number::text, ddf.value_date::text, ddf.value_boolean::text)`;
  if (op === "contains") {
    return `(
      ${textExpr} ILIKE '%' || ${pVal} || '%'
      OR ddf.value_json ? ${pVal}
      OR ddf.value_json::text ILIKE '%' || ${pVal} || '%'
    )`;
  }
  if (op === "gte") {
    return `(
      (${pNum} ~ '^-?[0-9]+(\\.[0-9]+)?$' AND ddf.value_number >= ${pNum}::numeric)
      OR (${pDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND ddf.value_date >= ${pDate}::date)
    )`;
  }
  if (op === "lte") {
    return `(
      (${pNum} ~ '^-?[0-9]+(\\.[0-9]+)?$' AND ddf.value_number <= ${pNum}::numeric)
      OR (${pDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND ddf.value_date <= ${pDate}::date)
    )`;
  }
  return `(
    ${textExpr} = ${pVal}
    OR (fd.tipe = 'boolean' AND ddf.value_boolean = ${pBool}::boolean)
    OR ddf.value_json @> ${pJson}::jsonb
  )`;
}

export async function POST(req: Request) {
  const g = await guard("donors", "read");
  if (g.error) return g.error;
  const parsed = searchSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const conditions = parsed.data.conditions;
  const match = parsed.data.match;
  const sql = getDb();
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const clauses: string[] = [];
  for (const c of conditions) {
    if (!c.field || c.value == null || c.value === "") continue;
    const field = c.field.replace(/[^a-z0-9_]/gi, "");
    if (!field) continue;
    const op = ["eq", "contains", "gte", "lte", "contains_all", "contains_any"].includes(c.op) ? c.op : "eq";
    const boolVal = c.value === "Ya" || c.value === "true" ? "true" : c.value === "Tidak" || c.value === "false" ? "false" : c.value;
    if (field === "tags") {
      const slugs = c.value
        .split(",")
        .map((s) => s.trim().replace(/[^a-z0-9_]/gi, ""))
        .filter(Boolean);
      if (slugs.length === 0) continue;
      const p = add(slugs);
      if (op === "contains_any") clauses.push(`d.tags && ${p}::text[]`);
      else clauses.push(`d.tags @> ${p}::text[]`);
    } else if (CORE_SEARCH_FIELDS.has(field)) {
      const expr = `i.search_doc->>'${field}'`;
      const p = add(c.value);
      if (op === "contains") clauses.push(`${expr} ILIKE '%' || ${p} || '%'`);
      else clauses.push(`${expr} = ${p}`);
    } else {
      const pSlug = add(field);
      const pVal = add(c.value);
      const pBool = add(boolVal);
      const pJson = add(JSON.stringify([c.value]));
      const pNum = add(c.value);
      const pDate = add(c.value);
      clauses.push(`EXISTS (
        SELECT 1 FROM donor_dynamic_fields ddf
        JOIN field_definitions fd ON fd.id = ddf.field_def_id
        WHERE ddf.donor_id = d.id AND fd.is_active = TRUE AND fd.slug = ${pSlug}
          AND ${dynCompareSql(op, pSlug, pVal, pBool, pJson, pNum, pDate)}
      )`);
    }
  }
  const filter = clauses.length === 0 ? "TRUE" : clauses.map((x) => `(${x})`).join(match === "or" ? " OR " : " AND ");
  const result = await sql.query(
    `SELECT d.id, d.nama_lengkap, d.no_hp_canonical, d.segmen_rfm, d.status_kontak, d.total_donation_lifetime,
            d.tags, u.nama AS assigned_nama,
            COALESCE((
              SELECT jsonb_object_agg(
                fd.slug,
                COALESCE(ddf.value_json, to_jsonb(ddf.value_text), to_jsonb(ddf.value_number),
                         to_jsonb(ddf.value_date), to_jsonb(ddf.value_boolean))
              )
              FROM donor_dynamic_fields ddf
              JOIN field_definitions fd ON fd.id = ddf.field_def_id AND fd.is_active = TRUE
              WHERE ddf.donor_id = d.id
            ), '{}'::jsonb) AS dynamic
     FROM donor_search_index i
     JOIN donors d ON d.id = i.donor_id
     LEFT JOIN users u ON u.id = d.assigned_to
     WHERE d.deleted_at IS NULL AND (${filter})
     ORDER BY d.nama_lengkap
     LIMIT 500`,
    params,
  );
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return NextResponse.json({ rows: jsonSafe(rows) });
}

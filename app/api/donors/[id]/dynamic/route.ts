import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("donors", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const rows = await sql`
    SELECT
      fd.id, fd.slug, fd.label, fd.tipe, fd.options_json, fd.is_required, fd.is_searchable,
      fd.is_active, fd.visible_in_json, fd.sort_order,
      ddf.value_text, ddf.value_number, ddf.value_date, ddf.value_boolean, ddf.value_json
    FROM field_definitions fd
    LEFT JOIN donor_dynamic_fields ddf
      ON ddf.field_def_id = fd.id AND ddf.donor_id = ${id}::bigint
    WHERE fd.is_active = TRUE
    ORDER BY fd.sort_order, fd.label
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("donors", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = z.object({ values: z.record(z.string(), z.unknown()) }).safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const defs = jsonSafe(
    await sql`SELECT * FROM field_definitions ORDER BY sort_order, label`,
  ) as Array<{ id: string; slug: string; tipe: string; is_active: boolean }>;
  const userId = g.session!.user.id === "0" ? null : g.session!.user.id;
  for (const fd of defs) {
    if (!fd.is_active || !(fd.slug in parsed.data.values)) continue;
    const raw = parsed.data.values[fd.slug];
    let valueText: string | null = null;
    let valueNumber: string | null = null;
    let valueDate: string | null = null;
    let valueBoolean: boolean | null = null;
    let valueJson: string | null = null;
    if (raw !== null && raw !== undefined && raw !== "") {
      if (fd.tipe === "number") valueNumber = String(raw);
      else if (fd.tipe === "date") valueDate = String(raw).slice(0, 10);
      else if (fd.tipe === "boolean") valueBoolean = raw === true || raw === "true" || raw === "Ya";
      else if (fd.tipe === "multiselect") {
        const arr = Array.isArray(raw)
          ? raw
          : String(raw)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        valueJson = JSON.stringify(arr);
      } else valueText = String(raw);
    }
    await sql`
      INSERT INTO donor_dynamic_fields (
        donor_id, field_def_id, value_text, value_number, value_date, value_boolean, value_json, updated_by
      )
      VALUES (
        ${id}::bigint, ${fd.id}::bigint, ${valueText}, ${valueNumber}::numeric,
        ${valueDate}::date, ${valueBoolean}, ${valueJson}::jsonb, ${userId}
      )
      ON CONFLICT (donor_id, field_def_id) DO UPDATE SET
        value_text = EXCLUDED.value_text,
        value_number = EXCLUDED.value_number,
        value_date = EXCLUDED.value_date,
        value_boolean = EXCLUDED.value_boolean,
        value_json = EXCLUDED.value_json,
        updated_by = EXCLUDED.updated_by
    `;
  }
  await sql`SELECT fn_rebuild_search_index(${id}::bigint)`;
  await logAudit({
    userId: g.session!.user.id,
    donorId: id,
    action: "update",
    entityType: "donor_dynamic",
    entityId: id,
    valueAfter: parsed.data.values,
  });
  return NextResponse.json({ success: true });
}

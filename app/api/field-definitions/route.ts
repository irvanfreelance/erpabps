import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { fieldDefinitionSchema } from "@/lib/validators/field-definition";

export async function GET() {
  const g = await guard("field_definitions", "read");
  if (g.error) return g.error;
  const sql = getDb();
  return NextResponse.json({ rows: jsonSafe(await sql`SELECT * FROM field_definitions ORDER BY sort_order, label`) });
}

export async function POST(req: Request) {
  const g = await guard("field_definitions", "config");
  if (g.error) return g.error;
  const parsed = fieldDefinitionSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const createdBy = g.session!.user.id === "0" ? null : g.session!.user.id;
  const rows = await sql`
    INSERT INTO field_definitions (
      slug, label, tipe, options_json, is_required, is_searchable, is_active,
      visible_in_json, sort_order, created_by
    )
    VALUES (
      ${parsed.data.slug}, ${parsed.data.label}, ${parsed.data.tipe},
      ${JSON.stringify(parsed.data.optionsJson ?? [])}::jsonb,
      ${parsed.data.isRequired ?? false}, ${parsed.data.isSearchable ?? true}, ${parsed.data.isActive ?? true},
      ${JSON.stringify(parsed.data.visibleInJson ?? ["profil", "list", "export"])}::jsonb,
      ${parsed.data.sortOrder ?? 0}, ${createdBy}
    )
    ON CONFLICT (slug) DO UPDATE SET
      label = EXCLUDED.label,
      tipe = EXCLUDED.tipe,
      options_json = EXCLUDED.options_json,
      is_required = EXCLUDED.is_required,
      is_searchable = EXCLUDED.is_searchable,
      is_active = EXCLUDED.is_active,
      visible_in_json = EXCLUDED.visible_in_json,
      sort_order = EXCLUDED.sort_order
    RETURNING *
  `;
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "field_def",
    valueAfter: parsed.data,
  });
  return NextResponse.json(jsonSafe(rows)[0]);
}

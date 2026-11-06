import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { updateFieldDefinitionSchema } from "@/lib/validators/field-definition";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("field_definitions", "config");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = updateFieldDefinitionSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const input = parsed.data;
  const sql = getDb();
  const rows = await sql`
    UPDATE field_definitions SET
      label = COALESCE(${input.label ?? null}, label),
      tipe = COALESCE(${input.tipe ?? null}, tipe),
      options_json = COALESCE(${input.optionsJson != null ? JSON.stringify(input.optionsJson) : null}::jsonb, options_json),
      is_required = COALESCE(${input.isRequired ?? null}, is_required),
      is_searchable = COALESCE(${input.isSearchable ?? null}, is_searchable),
      is_active = COALESCE(${input.isActive ?? null}, is_active),
      visible_in_json = COALESCE(${input.visibleInJson ? JSON.stringify(input.visibleInJson) : null}::jsonb, visible_in_json),
      sort_order = COALESCE(${input.sortOrder ?? null}, sort_order)
    WHERE id = ${id}::bigint
    RETURNING *
  `;
  const row = jsonSafe(rows[0] ?? null);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({
    userId: g.session!.user.id,
    action: "update",
    entityType: "field_def",
    entityId: id,
    valueAfter: parsed.data,
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("field_definitions", "config");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  await sql`UPDATE field_definitions SET is_active = FALSE WHERE id = ${id}::bigint`;
  await logAudit({
    userId: g.session!.user.id,
    action: "delete",
    entityType: "field_def",
    entityId: id,
  });
  return NextResponse.json({ success: true });
}

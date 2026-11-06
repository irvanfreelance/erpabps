import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  departmentId: z.string().optional(),
  payrollType: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("positions", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    UPDATE positions SET
      code = COALESCE(${parsed.data.code ?? null}, code),
      name = COALESCE(${parsed.data.name ?? null}, name),
      department_id = COALESCE(${parsed.data.departmentId ?? null}::bigint, department_id),
      payroll_type = COALESCE(${parsed.data.payrollType ?? null}, payroll_type),
      updated_at = now()
    WHERE id = ${id}::bigint AND deleted_at IS NULL
    RETURNING id, code, name, payroll_type, department_id
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "position", entityId: id });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("positions", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  await sql`UPDATE positions SET deleted_at = now(), updated_at = now() WHERE id = ${id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "position", entityId: id });
  return NextResponse.json({ ok: true });
}

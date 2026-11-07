import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { canAccessEmployee } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";
import { familySchema } from "@/lib/validators/employee";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = familySchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  if (!(await canAccessEmployee(sql, g.session!.user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await sql`
    INSERT INTO employee_family_members (employee_id, relation, full_name, birth_date)
    VALUES (${id}::bigint, ${parsed.data.relation}, ${parsed.data.fullName}, ${parsed.data.birthDate || null}::date)
    RETURNING id
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "employee_family", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  await ctx.params;
  const body = await req.json();
  const familyId = String(body.familyId ?? "");
  if (!familyId) return NextResponse.json({ error: "familyId wajib" }, { status: 400 });
  const parsed = familySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    UPDATE employee_family_members SET
      relation = ${parsed.data.relation},
      full_name = ${parsed.data.fullName},
      birth_date = ${parsed.data.birthDate || null}::date
    WHERE id = ${familyId}::bigint
    RETURNING id
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "employee_family", entityId: familyId });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  await ctx.params;
  const familyId = new URL(req.url).searchParams.get("familyId");
  if (!familyId) return NextResponse.json({ error: "familyId wajib" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM employee_family_members WHERE id = ${familyId}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "employee_family", entityId: familyId });
  return NextResponse.json({ ok: true });
}

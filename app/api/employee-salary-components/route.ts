import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { salaryComponentAssignSchema } from "@/lib/validators/employee";

export async function POST(req: Request) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const parsed = salaryComponentAssignSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO employee_salary_components (employee_id, salary_component_id, amount, effective_from, effective_until)
    VALUES (
      ${parsed.data.employeeId}::bigint, ${parsed.data.salaryComponentId}::bigint,
      ${parsed.data.amount}, ${parsed.data.effectiveFrom}::date, ${parsed.data.effectiveUntil ?? null}::date
    )
    RETURNING id
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "employee_salary_component", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function PATCH(req: Request) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const parsed = salaryComponentAssignSchema.partial().safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const sql = getDb();
  const rows = await sql`
    UPDATE employee_salary_components SET
      salary_component_id = COALESCE(${d.salaryComponentId || null}::bigint, salary_component_id),
      amount = COALESCE(${d.amount ?? null}, amount),
      effective_from = COALESCE(${d.effectiveFrom || null}::date, effective_from),
      effective_until = CASE WHEN ${d.effectiveUntil !== undefined} THEN ${d.effectiveUntil || null}::date ELSE effective_until END
    WHERE id = ${id}::bigint
    RETURNING id
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "employee_salary_component", entityId: id });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function DELETE(req: Request) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM employee_salary_components WHERE id = ${id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "employee_salary_component", entityId: id });
  return NextResponse.json({ ok: true });
}

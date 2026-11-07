import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { canAccessEmployee } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";
import { educationSchema } from "@/lib/validators/employee";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = educationSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  if (!(await canAccessEmployee(sql, g.session!.user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await sql`
    INSERT INTO employee_educations (employee_id, level, institution, major, start_year, end_year)
    VALUES (
      ${id}::bigint, ${parsed.data.level}, ${parsed.data.institution}, ${parsed.data.major ?? null},
      ${parsed.data.startYear ?? null}, ${parsed.data.endYear ?? null}
    )
    RETURNING id
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "employee_education", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  await ctx.params;
  const body = await req.json();
  const educationId = String(body.educationId ?? "");
  if (!educationId) return NextResponse.json({ error: "educationId wajib" }, { status: 400 });
  const parsed = educationSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    UPDATE employee_educations SET
      level = ${parsed.data.level},
      institution = ${parsed.data.institution},
      major = ${parsed.data.major ?? null},
      start_year = ${parsed.data.startYear ?? null},
      end_year = ${parsed.data.endYear ?? null}
    WHERE id = ${educationId}::bigint
    RETURNING id
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "employee_education", entityId: educationId });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  await ctx.params;
  const educationId = new URL(req.url).searchParams.get("educationId");
  if (!educationId) return NextResponse.json({ error: "educationId wajib" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM employee_educations WHERE id = ${educationId}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "employee_education", entityId: educationId });
  return NextResponse.json({ ok: true });
}

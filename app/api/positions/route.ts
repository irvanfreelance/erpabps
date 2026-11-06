import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  departmentId: z.string(),
  payrollType: z.string().default("monthly_split"),
});

export async function GET() {
  const g = await guard("positions", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT p.id, p.code, p.name, p.payroll_type, p.department_id, d.name AS department_name
    FROM positions p LEFT JOIN departments d ON d.id = p.department_id
    WHERE p.deleted_at IS NULL ORDER BY p.name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("positions", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO positions (department_id, name, code, payroll_type)
    VALUES (${parsed.data.departmentId}::bigint, ${parsed.data.name}, ${parsed.data.code}, ${parsed.data.payrollType})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, code, name
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "position", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}

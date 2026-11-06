import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  componentType: z.string().min(1),
});

export async function GET() {
  const g = await guard("salary-components", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, code, name, component_type, is_active FROM salary_components ORDER BY name`;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("salary-components", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO salary_components (code, name, component_type)
    VALUES (${parsed.data.code}, ${parsed.data.name}, ${parsed.data.componentType})
    ON CONFLICT (code) DO NOTHING
    RETURNING id, code, name, component_type
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "salary_component" });
  return NextResponse.json(jsonSafe(rows[0] ?? { ok: true }));
}

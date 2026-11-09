import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1).regex(/^[a-z0-9_-]+$/i, "Kode hanya huruf/angka/strip"),
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET() {
  const g = await guard("employee-types", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT id, code, name, description, is_active
    FROM employee_types
    WHERE deleted_at IS NULL
    ORDER BY id
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("employee-types", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO employee_types (code, name, description)
    VALUES (${parsed.data.code.toLowerCase()}, ${parsed.data.name}, ${parsed.data.description ?? null})
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      deleted_at = NULL,
      updated_at = now()
    RETURNING id, code, name, description
  `;
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "employee_type",
    entityId: String((rows[0] as { id: string }).id),
  });
  return NextResponse.json(jsonSafe(rows[0]));
}

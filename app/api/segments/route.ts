import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("segments", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT s.*, u.nama AS dibuat_oleh_nama
    FROM saved_segments s JOIN users u ON u.id = s.dibuat_oleh
    ORDER BY s.updated_at DESC
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}

export async function POST(req: Request) {
  const g = await guard("segments", "create");
  if (g.error) return g.error;
  const body = await req.json();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO saved_segments (nama, deskripsi, query_json, is_public, dibuat_oleh)
    VALUES (${body.nama}, ${body.deskripsi ?? null}, ${JSON.stringify(body.queryJson)}::jsonb, ${body.isPublic ?? true}, ${g.session!.user.id})
    RETURNING *
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "segment", valueAfter: body });
  return NextResponse.json(rows[0]);
}

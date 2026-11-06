import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("campaigns", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT c.*, p.nama AS program_nama
    FROM campaigns c LEFT JOIN programs p ON p.id = c.program_id
    ORDER BY c.tgl_mulai DESC NULLS LAST, c.nama
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}

export async function POST(req: Request) {
  const g = await guard("campaigns", "create");
  if (g.error) return g.error;
  const body = await req.json();
  const sql = getDb();
  const rows = body.id
    ? await sql`
        UPDATE campaigns SET nama = ${body.nama}, tipe = ${body.tipe}, program_id = ${body.programId ?? null},
          tgl_mulai = ${body.tglMulai ?? null}, tgl_selesai = ${body.tglSelesai ?? null}
        WHERE id = ${body.id} RETURNING *
      `
    : await sql`
        INSERT INTO campaigns (slug, nama, tipe, program_id, tgl_mulai, tgl_selesai, created_by)
        VALUES (${body.slug}, ${body.nama}, ${body.tipe}, ${body.programId ?? null}, ${body.tglMulai ?? null}, ${body.tglSelesai ?? null}, ${g.session!.user.id})
        RETURNING *
      `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "campaign", valueAfter: body });
  return NextResponse.json(rows[0]);
}

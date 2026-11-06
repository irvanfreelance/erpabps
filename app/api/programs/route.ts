import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("programs", "read");
  if (g.error) return g.error;
  const sql = getDb();
  return NextResponse.json({ rows: jsonSafe(await sql`SELECT * FROM programs ORDER BY sort_order, nama`) });
}

export async function POST(req: Request) {
  const g = await guard("programs", "create");
  if (g.error) return g.error;
  const body = await req.json();
  const sql = getDb();
  const rows = body.id
    ? await sql`
        UPDATE programs SET nama = ${body.nama}, kategori = ${body.kategori}, deskripsi = ${body.deskripsi ?? null}
        WHERE id = ${body.id} RETURNING *
      `
    : await sql`
        INSERT INTO programs (slug, nama, kategori, deskripsi, created_by)
        VALUES (${body.slug}, ${body.nama}, ${body.kategori}, ${body.deskripsi ?? null}, ${g.session!.user.id})
        RETURNING *
      `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "program", valueAfter: body });
  return NextResponse.json(rows[0]);
}

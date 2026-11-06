import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Berkas KTP opsional; jika diunggah wajib gambar" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Gunakan PNG, JPG, atau WEBP" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "KTP maksimal 2 MB" }, { status: 400 });
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN belum di-set. Profil lain tetap bisa disimpan tanpa KTP." },
      { status: 400 },
    );
  }
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  try {
    const blob = await put(`employees/${id}/ktp.${ext}`, file, {
      access: "public",
      token,
      addRandomSuffix: true,
      contentType: file.type,
    });
    const sql = getDb();
    await sql`UPDATE employees SET ktp_image_url = ${blob.url}, updated_at = now() WHERE id = ${id}::bigint`;
    await logAudit({ userId: g.session!.user.id, action: "update", entityType: "employee_ktp", entityId: id });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unggah gagal";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  await sql`UPDATE employees SET ktp_image_url = NULL, updated_at = now() WHERE id = ${id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "employee_ktp", entityId: id });
  return NextResponse.json({ ok: true });
}

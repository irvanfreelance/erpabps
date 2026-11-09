import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { COOKIE_NAME, signImpersonation } from "@/lib/auth/impersonate";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/impersonate
 * Body: { employeeId: string }
 * Syarat: User harus superadmin (baik sesi asli maupun saat impersonate).
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Jika sedang impersonate, impersonatedBy menyimpan identitas asli superadmin
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) {
    return NextResponse.json({ error: "Hanya superadmin yang dapat melakukan impersonate" }, { status: 403 });
  }

  const body = (await req.json()) as { employeeId?: string };
  const employeeId = body?.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId wajib diisi" }, { status: 400 });
  }

  const sql = getDb();
  const emp = await sql`
    SELECT id, full_name, email FROM employees
    WHERE id = ${employeeId}::bigint AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!emp[0]) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  const cookieVal = signImpersonation(String(employeeId));
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, cookieVal, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60, // 7 hari
  });

  const actorUserId = session.user.impersonatedBy ? session.user.impersonatedBy.id : session.user.id;
  await logAudit({
    userId: actorUserId,
    action: "impersonate_start",
    entityType: "employees",
    entityId: String(employeeId),
    valueAfter: { targetName: emp[0].full_name, targetEmail: emp[0].email },
  });

  return NextResponse.json({
    ok: true,
    message: `Berhasil login sebagai ${emp[0].full_name}`,
  });
}

/**
 * DELETE /api/auth/impersonate
 * Menghentikan impersonasi dan kembali ke akun asli Superadmin.
 */
export async function DELETE() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  if (session.user.impersonatedBy) {
    await logAudit({
      userId: session.user.impersonatedBy.id,
      action: "impersonate_stop",
      entityType: "employees",
      entityId: session.user.employeeId || "0",
      valueBefore: { targetName: session.user.nama },
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Impersonasi dihentikan, kembali ke Superadmin",
  });
}

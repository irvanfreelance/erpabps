import { ClockActions } from "@/components/hrd/clock-actions";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ownEmployeeId } from "@/lib/hrd/scope";

export const metadata = { title: "Clock-in — ABPS" };

export default async function Page() {
  const session = await getServerSession();
  let linked = false;
  try {
    const sql = getDb();
    linked = Boolean(session && (await ownEmployeeId(sql, session.user)));
  } catch {
    linked = false;
  }
  return (
    <div>
      <h1 className="mb-2 mt-0 text-[20px] font-bold text-[var(--primary)]">Clock-in</h1>
      {linked ? (
        <ClockActions />
      ) : (
        <p className="text-[13px] text-[#666]">
          Akun superadmin ini tidak terhubung ke baris karyawan, jadi clock-in diri tidak bisa. Gunakan rekap dan
          backdate untuk orang lain.
        </p>
      )}
    </div>
  );
}

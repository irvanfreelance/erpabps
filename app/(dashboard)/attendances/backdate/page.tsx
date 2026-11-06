import { GET as listEmp } from "@/app/api/employees/route";
import { BackdateForm } from "@/components/hrd/backdate-form";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Backdate presensi — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; full_name: string }[] }>(await listEmp());
  return (
    <div>
      <h1 className="mb-2 mt-0 text-[20px] font-bold text-[var(--primary)]">Koreksi backdate</h1>
      <p className="mb-3 text-[13px] text-[#666]">Hanya superadmin. Alasan wajib. Jejak ke audit_logs.</p>
      <p className="mb-3 text-[12px] text-[#888]">{rows.map((r) => `${r.id}:${r.full_name}`).join(" · ")}</p>
      <BackdateForm />
    </div>
  );
}

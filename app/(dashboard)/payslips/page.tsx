import { GET as list } from "@/app/api/payroll-items/route";
import { PayslipsTable } from "@/components/hrd/payslips-table";
import { fromRoute, internalRequest } from "@/lib/api/from-route";
import { PayslipItem } from "@/lib/utils/export-payslip-pdf";

export const metadata = { title: "Slip Gaji" };

export default async function Page() {
  const { rows } = await fromRoute<{
    rows: PayslipItem[];
  }>(await list(internalRequest("/api/payroll-items")));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-bold text-[var(--primary)]">Slip Gaji</h1>
        <p className="text-[13px] text-gray-500">
          Riwayat penggajian Anda di seluruh periode. Anda dapat melihat rincian kalkulasi dan mengunduh berkas PDF slip gaji resmi.
        </p>
      </div>

      <PayslipsTable rows={rows} />
    </div>
  );
}

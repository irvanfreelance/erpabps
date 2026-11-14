import { GET as list } from "@/app/api/reports/attendance/route";
import {
  AttendanceReportWorkspace,
  type AttendanceRawRow,
  type AttendanceRecapRow,
} from "@/components/hrd/attendance-report-workspace";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Laporan kehadiran" };

export default async function Page() {
  const { from, to, recap, raw } = await fromRoute<{
    from: string;
    to: string;
    recap: AttendanceRecapRow[];
    raw: AttendanceRawRow[];
  }>(await list());

  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">
        Laporan kehadiran
      </h1>
      <AttendanceReportWorkspace
        initialFrom={from}
        initialTo={to}
        initialRecap={recap}
        initialRaw={raw}
      />
    </div>
  );
}

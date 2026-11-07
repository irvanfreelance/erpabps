import { GET as list } from "@/app/api/shift-assignments/route";
import { GET as listLoc } from "@/app/api/locations/route";
import { ScheduleBoard } from "@/components/hrd/schedule-board";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Kalender jadwal — ABPS" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; locationId?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "2026-11";
  const locationId = sp.locationId ?? "";
  const q = new URLSearchParams({ month });
  if (locationId) q.set("locationId", locationId);
  const data = await fromRoute<{
    employees: never[];
    rows: never[];
    templates: never[];
    canWrite: boolean;
  }>(await list(internalRequest(`/api/shift-assignments?${q.toString()}`)));
  let loc = { rows: [] as { id: string; name: string }[] };
  try {
    loc = await fromRoute<{ rows: { id: string; name: string }[] }>(await listLoc());
  } catch {
    loc = { rows: [] };
  }
  const { employees, rows, templates, canWrite } = data;
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Jadwal crew outlet</h1>
      <ScheduleBoard
        month={month}
        locationId={locationId}
        locations={loc.rows}
        employees={employees as never}
        rows={rows as never}
        templates={templates as never}
        canWrite={canWrite}
      />
    </div>
  );
}

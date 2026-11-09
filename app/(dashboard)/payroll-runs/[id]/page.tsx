import { GET as getRun } from "@/app/api/payroll-runs/[id]/route";
import { RunManager, RunItem } from "@/components/hrd/run-manager";
import { fromRoute, internalRequest } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Detail Payroll Run" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const isSuperadmin = session?.user.role === "superadmin";

  const data = await fromRoute<{
    run: { id: string; status: string; period_start: string; period_end: string; pay_group_name: string };
    items: RunItem[];
  }>(await getRun(internalRequest(`/api/payroll-runs/${id}`), { params: Promise.resolve({ id }) }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--primary)]">{data.run.pay_group_name}</h1>
        <p className="text-[13px] text-gray-600">
          Periode: {data.run.period_start} s/d {data.run.period_end} · Status:{" "}
          <strong className="uppercase">{data.run.status}</strong>
        </p>
      </div>

      <RunManager
        runId={id}
        status={data.run.status}
        items={data.items}
        isSuperadmin={isSuperadmin}
      />
    </div>
  );
}

import { GET as list } from "@/app/api/approval-policies/route";
import { PolicyForm } from "@/components/hrd/policy-form";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Kebijakan persetujuan — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{
    rows: { id: string; category: string | null; requires_approval: boolean; min_approvers: number; status: string }[];
  }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Kebijakan persetujuan</h1>
      <PolicyForm />
      <DataTable
        data={rows}
        columns={[
          { key: "category", label: "Kategori" },
          { key: "requires_approval", label: "Perlu" },
          { key: "min_approvers", label: "Min" },
          { key: "status", label: "Status" },
        ]}
      />
    </div>
  );
}

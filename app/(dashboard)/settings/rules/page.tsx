import { GET as list } from "@/app/api/settings/route";
import { RuleForm } from "@/components/hrd/rule-form";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Aturan — ABPS" };

export default async function Page() {
  const { definitions, values } = await fromRoute<{
    definitions: { id: string; key: string; label: string; default_value: unknown; is_locked: boolean }[];
    values: { id: string; key: string; scope_type: string; value: unknown; source_ref: string; reason: string }[];
  }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Registry aturan</h1>
      <RuleForm keys={definitions.map((d) => d.key)} />
      <h2 className="mt-6 text-[16px] font-bold">Definisi</h2>
      <DataTable
        data={definitions}
        columns={[
          { key: "key", label: "Kunci" },
          { key: "label", label: "Label" },
          { key: "is_locked", label: "Terkunci" },
        ]}
      />
      <h2 className="mt-6 text-[16px] font-bold">Nilai aktif</h2>
      <DataTable
        data={values}
        columns={[
          { key: "key", label: "Kunci" },
          { key: "scope_type", label: "Scope" },
          { key: "source_ref", label: "Sumber" },
          { key: "reason", label: "Alasan" },
        ]}
      />
    </div>
  );
}

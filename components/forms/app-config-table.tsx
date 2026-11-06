"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";

type Row = {
  key: string;
  value: string;
  description: string | null;
};

export function AppConfigTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  return (
    <div>
      <h2 className="mb-3 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[20px]">
        Konfigurasi operasional ({rows.length})
      </h2>
      <DataTable
        data={rows.map((r) => ({ ...r, id: r.key }))}
        exportFilename="app-config"
        columns={[
          { key: "key", label: "Key" },
          {
            key: "value",
            label: "Value",
            render: (r) => (
              <input
                className="min-h-9 w-full max-w-xs rounded-xl border border-[#ddd] px-2 text-[13px]"
                defaultValue={r.value}
                onClick={(e) => e.stopPropagation()}
                onBlur={async (e) => {
                  const value = e.target.value;
                  if (value === r.value) return;
                  const res = await fetch("/api/app-config", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: r.key, value }),
                  });
                  if (!res.ok) toast.error("Gagal menyimpan " + r.key);
                  else {
                    toast.success(`${r.key} tersimpan`);
                    router.refresh();
                  }
                }}
              />
            ),
          },
          { key: "description", label: "Deskripsi" },
        ]}
      />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ImportWizard() {
  const router = useRouter();
  return (
    <div className="mb-4 rounded-[10px] bg-white p-4 shadow-sm">
      <div className="mb-2 text-[13px] font-bold text-[var(--primary)]">Unggah CSV donatur (kolom: nama, phone, email)</div>
      <input
        type="file"
        accept=".csv,text/csv"
        className="w-full max-w-full text-[13px]"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter(Boolean);
          const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
          const rows = lines.slice(1).map((line) => {
            const cols = line.split(",");
            const obj: Record<string, string> = {};
            header.forEach((h, i) => {
              obj[h] = cols[i]?.trim() ?? "";
            });
            return { nama: obj.nama || obj.name, phone: obj.phone || obj.no_hp || obj.hp, email: obj.email };
          });
          const res = await fetch("/api/data-imports/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, rows }),
          });
          const json = await res.json();
          if (!res.ok) toast.error("Import gagal");
          else {
            toast.success(`Import: ${json.nNew} baru, ${json.nMerge} merge`);
            router.refresh();
          }
        }}
      />
    </div>
  );
}

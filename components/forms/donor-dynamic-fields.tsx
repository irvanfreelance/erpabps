"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";
import { btnBlock, btnPrimary } from "@/components/ui/button";
import { fieldOptions, fieldVisible, type FieldDef } from "@/lib/org/field-value";

type ValueRow = FieldDef & {
  value_text: string | null;
  value_number: string | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: unknown;
};

function initialValue(row: ValueRow): string | string[] | boolean {
  if (row.tipe === "boolean") return Boolean(row.value_boolean);
  if (row.tipe === "multiselect") {
    return Array.isArray(row.value_json) ? row.value_json.map(String) : [];
  }
  if (row.tipe === "number") return row.value_number ?? "";
  if (row.tipe === "date") return row.value_date ? String(row.value_date).slice(0, 10) : "";
  return row.value_text ?? "";
}

export function DonorDynamicFieldsForm({ donorId, rows }: { donorId: string; rows: ValueRow[] }) {
  const router = useRouter();
  const visible = rows.filter((r) => fieldVisible(r, "profil") || r.is_active);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(visible.map((r) => [r.slug, initialValue(r)])),
  );

  const payload = useMemo(() => values, [values]);

  async function save() {
    const res = await fetch(`/api/donors/${donorId}/dynamic`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: payload }),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan field dinamis");
      return;
    }
    toast.success("Field dinamis tersimpan");
    router.refresh();
  }

  if (visible.length === 0) return null;

  return (
    <div className="mb-3.5 rounded-[10px] bg-white p-[18px] shadow-sm">
      <div className="mb-3 text-[10px] font-bold tracking-wide text-[#888]">FIELD DINAMIS</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible.map((fd) => {
          const opts = fieldOptions(fd).map((o) => ({ value: o, label: o }));
          const v = values[fd.slug];
          return (
            <label key={fd.slug} className="block text-[12px]">
              <span className="mb-1 block font-semibold text-[#444]">
                {fd.label}
                {fd.is_required ? " *" : ""}
              </span>
              {fd.tipe === "boolean" ? (
                <input
                  type="checkbox"
                  checked={v === true}
                  onChange={(e) => setValues((s) => ({ ...s, [fd.slug]: e.target.checked }))}
                />
              ) : fd.tipe === "dropdown" ? (
                <SearchSelect
                  value={String(v ?? "")}
                  options={opts}
                  onChange={(nv) => setValues((s) => ({ ...s, [fd.slug]: nv }))}
                />
              ) : fd.tipe === "multiselect" ? (
                <div className="flex flex-wrap gap-2">
                  {fieldOptions(fd).map((o) => {
                    const selected = Array.isArray(v) && v.includes(o);
                    return (
                      <label key={o} className="inline-flex items-center gap-1 text-[13px] font-normal">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const cur = Array.isArray(v) ? [...v] : [];
                            setValues((s) => ({
                              ...s,
                              [fd.slug]: e.target.checked ? [...cur, o] : cur.filter((x) => x !== o),
                            }));
                          }}
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <input
                  type={fd.tipe === "number" ? "number" : fd.tipe === "date" ? "date" : fd.tipe === "url" ? "url" : "text"}
                  className="w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
                  value={String(v ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [fd.slug]: e.target.value }))}
                />
              )}
            </label>
          );
        })}
      </div>
      <button type="button" className={`mt-4 ${btnPrimary} ${btnBlock}`} onClick={() => void save()}>
        Simpan field
      </button>
    </div>
  );
}

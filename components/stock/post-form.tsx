"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnPrimarySm, btnSecondary } from "@/components/ui/button";

export type Opt = { id: string; label: string };

type Field =
  | { name: string; label: string; kind: "text" | "date" | "number" | "textarea"; required?: boolean; step?: string }
  | { name: string; label: string; kind: "select"; required?: boolean; options: Opt[]; empty?: string };

type LineSeed = { item_id: string; qty: string; unit_price?: string; qty_count?: string; unit_cost?: string };

export function PostForm({
  title,
  hint,
  endpoint,
  fields,
  items,
  lineMode = "none",
  presets,
  docPrefix,
}: {
  title: string;
  hint?: string;
  endpoint: string;
  fields: Field[];
  items?: Opt[];
  lineMode?: "none" | "qty" | "qty-price" | "count";
  presets?: { field: string; map: Record<string, LineSeed[]> };
  docPrefix: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<LineSeed[]>([]);

  const defaultLines = useMemo<LineSeed[]>(
    () => [
      {
        item_id: items?.[0]?.id ?? "",
        qty: "1",
        unit_price: "",
        qty_count: "0",
        unit_cost: "",
      },
    ],
    [items],
  );

  const openForm = () => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      next[field.name] = field.kind === "date" ? new Date().toISOString().slice(0, 10) : "";
    }
    const docField = fields.find((field) => field.name === "doc_no");
    if (docField) next.doc_no = `${docPrefix}-${Date.now().toString().slice(-6)}`;
    setValues(next);
    setLines(lineMode === "none" ? [] : defaultLines);
    setOpen(true);
  };

  const setField = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (presets && name === presets.field) {
      const seeded = presets.map[value];
      if (seeded && seeded.length > 0) setLines(seeded);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = { ...values };
      for (const field of fields) {
        if (field.kind === "number" && values[field.name] !== "") body[field.name] = Number(values[field.name]);
        if ((field.kind === "text" || field.kind === "select" || field.kind === "textarea") && values[field.name] === "") {
          delete body[field.name];
        }
      }
      if (lineMode !== "none") {
        body.lines = lines
          .filter((line) => line.item_id)
          .map((line) => {
            if (lineMode === "count") {
              return {
                item_id: Number(line.item_id),
                qty_count: Number(line.qty_count || 0),
                unit_cost: line.unit_cost === "" ? null : Number(line.unit_cost),
              };
            }
            return {
              item_id: Number(line.item_id),
              qty: Number(line.qty),
              unit_price: line.unit_price === "" ? undefined : Number(line.unit_price),
              price_hint: line.unit_price === "" ? undefined : Number(line.unit_price),
            };
          });
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memposting");
      toast.success("Dokumen berhasil diposting");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memposting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      {hint ? <p className="m-0 max-w-xl text-xs text-gray-500">{hint}</p> : <span />}
      <button type="button" onClick={openForm} className={`${btnPrimarySm} gap-1.5`}>
        <Plus size={14} /> {title}
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)} maxWidth="sm:max-w-xl">
          <form onSubmit={submit} className="space-y-3">
            {fields.map((field) => (
              <label key={field.name} className="block text-xs font-semibold text-gray-700">
                {field.label}
                {field.kind === "select" ? (
                  <select
                    required={field.required !== false}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setField(field.name, e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">{field.empty ?? "Pilih"}</option>
                    {field.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "textarea" ? (
                  <textarea
                    required={field.required !== false}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setField(field.name, e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-[var(--primary)]"
                    rows={3}
                  />
                ) : (
                  <input
                    required={field.required !== false}
                    type={field.kind}
                    step={field.kind === "number" ? field.step ?? "0.01" : undefined}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setField(field.name, e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-[var(--primary)]"
                  />
                )}
              </label>
            ))}

            {lineMode !== "none" && items && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Baris barang</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--primary)]"
                    onClick={() => setLines((prev) => [...prev, { ...defaultLines[0] }])}
                  >
                    + Baris
                  </button>
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <select
                      className="col-span-6 rounded-xl border border-gray-200 px-2 py-2 text-sm"
                      value={line.item_id}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, i) => (i === index ? { ...row, item_id: e.target.value } : row)))
                      }
                    >
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {lineMode === "count" ? (
                      <>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="col-span-3 rounded-xl border border-gray-200 px-2 py-2 text-sm"
                          value={line.qty_count}
                          placeholder="Hitung"
                          onChange={(e) =>
                            setLines((prev) => prev.map((row, i) => (i === index ? { ...row, qty_count: e.target.value } : row)))
                          }
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="col-span-3 rounded-xl border border-gray-200 px-2 py-2 text-sm"
                          value={line.unit_cost}
                          placeholder="HPP jika baru"
                          onChange={(e) =>
                            setLines((prev) => prev.map((row, i) => (i === index ? { ...row, unit_cost: e.target.value } : row)))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          required
                          className="col-span-3 rounded-xl border border-gray-200 px-2 py-2 text-sm"
                          value={line.qty}
                          onChange={(e) =>
                            setLines((prev) => prev.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row)))
                          }
                        />
                        {lineMode === "qty-price" ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            placeholder="Harga"
                            className="col-span-3 rounded-xl border border-gray-200 px-2 py-2 text-sm"
                            value={line.unit_price}
                            onChange={(e) =>
                              setLines((prev) => prev.map((row, i) => (i === index ? { ...row, unit_price: e.target.value } : row)))
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            className="col-span-3 text-xs text-rose-600"
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                          >
                            Hapus
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
                Batal
              </button>
              <button type="submit" className={btnPrimary} disabled={loading}>
                {loading ? "Memposting..." : "Posting"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

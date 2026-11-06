"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/hrd/money-input";
import { btnPrimary } from "@/components/ui/button";
import { parseMoney } from "@/lib/utils/format";

export function SimpleCreate({
  action,
  fields,
  label = "Simpan",
}: {
  action: string;
  fields: { name: string; label: string; type?: string; placeholder?: string }[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [money, setMoney] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = String(fd.get(f.name) ?? "");
      if (f.type === "money") body[f.name] = parseMoney(money[f.name]);
      else if (f.type === "number") body[f.name] = raw === "" ? null : Number(raw);
      else body[f.name] = raw || null;
    }
    setPending(true);
    const res = await fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal menyimpan");
      return;
    }
    toast.success("Tersimpan");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mb-3">
      {!open ? (
        <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
          {label}
        </button>
      ) : (
        <form onSubmit={onSubmit} className="grid max-w-xl gap-2 rounded-xl border border-[#eee] bg-white p-3">
          {fields.map((f) => (
            <label key={f.name} className="grid gap-1 text-[12px] font-semibold text-[#555]">
              {f.label}
              {f.type === "money" ? (
                <MoneyInput value={money[f.name] ?? ""} onChange={(v) => setMoney({ ...money, [f.name]: v })} />
              ) : (
                <input
                  name={f.name}
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  placeholder={f.placeholder}
                  className="min-h-11 rounded-xl border border-[#ddd] px-3 text-[13px] font-normal"
                />
              )}
            </label>
          ))}
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={pending} type="submit">
              Simpan
            </button>
            <button type="button" className="text-[13px]" onClick={() => setOpen(false)}>
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

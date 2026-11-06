"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";
import { btnBlock, btnPrimary } from "@/components/ui/button";
import { TagChips } from "@/components/shared/tag-chips";
import type { TagCatalogItem } from "@/lib/org/field-value";

export function DonorTagsEditor({
  donorId,
  tags,
  catalog,
}: {
  donorId: string;
  tags: string[];
  catalog: TagCatalogItem[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("");
  const unused = useMemo(
    () => catalog.filter((t) => t.is_active && !tags.includes(t.slug)).map((t) => ({ value: t.slug, label: t.nama })),
    [catalog, tags],
  );

  async function add(value: string) {
    const v = value.trim();
    if (!v) return;
    const res = await fetch(`/api/donors/${donorId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: v }),
    });
    if (!res.ok) toast.error("Gagal menambah tag");
    else {
      toast.success("Tag ditambah");
      setPick("");
      setCustom("");
      router.refresh();
    }
  }

  async function remove(slug: string) {
    const res = await fetch(`/api/donors/${donorId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: slug }),
    });
    if (!res.ok) toast.error("Gagal menghapus tag");
    else {
      toast.success("Tag dihapus");
      router.refresh();
    }
  }

  return (
    <div className="mb-3.5 rounded-[10px] bg-white p-[18px] shadow-sm">
      <div className="mb-3 text-[10px] font-bold tracking-wide text-[#888]">LABEL</div>
      <TagChips slugs={tags} catalog={catalog} onRemove={(s) => void remove(s)} />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <SearchSelect
          className="sm:flex-1"
          value={pick}
          options={unused}
          placeholder="Pilih label…"
          onChange={(v) => {
            setPick(v);
            if (v) void add(v);
          }}
        />
        <input
          className="min-h-10 flex-1 rounded-xl border border-[#ddd] px-3 text-[13px]"
          placeholder="Atau ketik label baru"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add(custom);
            }
          }}
        />
        <button type="button" className={`${btnPrimary} ${btnBlock}`} onClick={() => void add(custom)}>
          Tambah
        </button>
      </div>
    </div>
  );
}

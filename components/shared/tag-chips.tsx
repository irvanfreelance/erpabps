"use client";

import type { TagCatalogItem } from "@/lib/org/field-value";

export function TagChips({
  slugs,
  catalog,
  onRemove,
}: {
  slugs: string[];
  catalog: TagCatalogItem[];
  onRemove?: (slug: string) => void;
}) {
  const map = new Map(catalog.map((t) => [t.slug, t]));
  if (!slugs.length) return <span className="text-[#999]">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {slugs.map((slug) => {
        const t = map.get(slug);
        const color = t?.warna || "#01665a";
        return (
          <span
            key={slug}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: color }}
          >
            {t?.nama || slug}
            {onRemove && (
              <button type="button" className="text-white/90" aria-label={`Hapus ${slug}`} onClick={() => onRemove(slug)}>
                ×
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

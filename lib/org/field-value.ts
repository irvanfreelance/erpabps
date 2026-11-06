export type FieldDef = {
  id: string;
  slug: string;
  label: string;
  tipe: string;
  options_json: unknown;
  is_required: boolean;
  is_searchable: boolean;
  is_active: boolean;
  visible_in_json: unknown;
  sort_order: number;
};

export function fieldOptions(fd: FieldDef): string[] {
  const raw = fd.options_json;
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export function fieldVisible(fd: FieldDef, surface: "profil" | "list" | "export"): boolean {
  const raw = fd.visible_in_json;
  if (!Array.isArray(raw) || raw.length === 0) return true;
  return raw.map(String).includes(surface);
}

export function formatFieldValue(tipe: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (tipe === "boolean") {
    if (value === true || value === "true" || value === "Ya") return "Ya";
    if (value === false || value === "false" || value === "Tidak") return "Tidak";
  }
  if (Array.isArray(value)) return value.map(String).join(", ") || "—";
  return String(value);
}

export function dynKey(slug: string) {
  return `dyn_${slug}`;
}

export type TagCatalogItem = { slug: string; nama: string; warna: string; is_active?: boolean };

export function formatTagNames(slugs: string[] | null | undefined, catalog: TagCatalogItem[]) {
  const map = new Map(catalog.map((t) => [t.slug, t.nama]));
  return (slugs ?? []).map((s) => map.get(s) || s).join(", ");
}

export function parseTagSlugs(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .replace(/[{}]/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

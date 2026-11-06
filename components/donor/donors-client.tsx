"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { QueryBuilder } from "@/components/query-builder/query-builder";
import { Badge } from "@/components/shared/badge";
import { TagChips } from "@/components/shared/tag-chips";
import { dynKey, fieldVisible, formatFieldValue, formatTagNames, parseTagSlugs, type FieldDef, type TagCatalogItem } from "@/lib/org/field-value";
import { fmtRp, toNum } from "@/lib/utils/format";
import { useState } from "react";

const SC: Record<string, string> = {
  champions: "#01665a",
  loyal: "#2e8b7a",
  potential: "#5cb8a8",
  at_risk: "#e74c3c",
  lost: "#95a5a6",
  new: "#3498db",
  one_time: "#f39c12",
};

type Row = {
  id: string;
  nama_lengkap: string;
  no_hp_canonical: string;
  status_kontak: string;
  segmen_rfm: string | null;
  total_donation_lifetime: string;
  assigned_nama: string | null;
  tags?: unknown;
  dynamic?: Record<string, unknown>;
};

function withDynamic(rows: Row[], fields: FieldDef[]): Row[] {
  return rows.map((r) => {
    const extra: Record<string, unknown> = { ...r };
    for (const fd of fields) {
      extra[dynKey(fd.slug)] = formatFieldValue(fd.tipe, r.dynamic?.[fd.slug]);
    }
    return extra as Row;
  });
}

function dynamicColumns(fields: FieldDef[]): Column<Row>[] {
  return fields
    .filter((fd) => fd.is_active && (fieldVisible(fd, "list") || fieldVisible(fd, "export")))
    .map((fd) => ({
      key: dynKey(fd.slug),
      label: fd.label,
      numeric: fd.tipe === "number",
      hideable: true,
      defaultHidden: !fieldVisible(fd, "list"),
      includeInExport: fieldVisible(fd, "export"),
      exportValue: (d) => formatFieldValue(fd.tipe, d.dynamic?.[fd.slug]),
    }));
}

function tagColumn(catalog: TagCatalogItem[]): Column<Row> {
  return {
    key: "tags",
    label: "Label",
    render: (d) => <TagChips slugs={parseTagSlugs(d.tags)} catalog={catalog} />,
    exportValue: (d) => formatTagNames(parseTagSlugs(d.tags), catalog),
  };
}

export function QueryBuilderPanel({ fields, tags }: { fields: FieldDef[]; tags: TagCatalogItem[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const router = useRouter();
  return (
    <>
      <QueryBuilder extraFields={fields.filter((f) => f.is_active)} tags={tags} onResults={(r) => setRows(r as Row[])} />
      {rows && (
        <div className="mb-3">
          <div className="mb-1 text-[12px] text-[#666]">Hasil query: {rows.length}</div>
          <DataTable
            data={withDynamic(rows, fields)}
            exportFilename="hasil-query"
            onRow={(r) => router.push(`/donors/${r.id}`)}
            columns={[
              { key: "nama_lengkap", label: "Nama" },
              { key: "no_hp_canonical", label: "HP" },
              { key: "segmen_rfm", label: "Segmen", exportValue: (d) => d.segmen_rfm || "" },
              tagColumn(tags),
              ...dynamicColumns(fields),
            ]}
          />
        </div>
      )}
    </>
  );
}

export function DonorsTable({ rows, fields, tags }: { rows: Row[]; fields: FieldDef[]; tags: TagCatalogItem[] }) {
  const router = useRouter();
  return (
    <DataTable
      data={withDynamic(rows, fields)}
      exportFilename="donatur"
      onRow={(r) => router.push(`/donors/${r.id}`)}
      columns={[
        { key: "nama_lengkap", label: "Nama" },
        { key: "no_hp_canonical", label: "No. HP" },
        { key: "status_kontak", label: "Status", render: (d) => <Badge>{d.status_kontak}</Badge> },
        {
          key: "segmen_rfm",
          label: "Segmen",
          render: (d) => (d.segmen_rfm ? <Badge color={SC[d.segmen_rfm] || "#999"}>{d.segmen_rfm}</Badge> : "—"),
          exportValue: (d) => d.segmen_rfm || "—",
        },
        {
          key: "total_donation_lifetime",
          label: "Total",
          numeric: true,
          render: (d) => fmtRp(toNum(d.total_donation_lifetime)),
          exportValue: (d) => fmtRp(toNum(d.total_donation_lifetime)),
        },
        {
          key: "assigned_nama",
          label: "PIC",
          render: (d) => d.assigned_nama || "—",
          exportValue: (d) => d.assigned_nama || "—",
        },
        tagColumn(tags),
        ...dynamicColumns(fields),
      ]}
    />
  );
}

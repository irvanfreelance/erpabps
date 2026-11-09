"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtRp } from "@/lib/utils/format";
import { Eye } from "lucide-react";
import { btnSecondary } from "@/components/ui/button";

export type VendorBillRow = {
  id: string;
  doc_no: string;
  receipt_no: string;
  vendor_name: string;
  amount: number | string;
  amount_open: number | string;
  due_date: string;
  status: string;
};

export function VendorBillsManager({ rows }: { rows: VendorBillRow[] }) {
  const [viewRow, setViewRow] = useState<VendorBillRow | null>(null);

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        exportFilename="Tagihan Vendor Hutang"
        columns={[
          { key: "doc_no", label: "No. Tagihan", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "receipt_no", label: "Ref GRN Penerimaan" },
          { key: "vendor_name", label: "Vendor" },
          { key: "amount", label: "Total Tagihan", numeric: true, render: (r) => fmtRp(r.amount) },
          {
            key: "amount_open",
            label: "Sisa Hutang",
            numeric: true,
            render: (r) => (
              <span className={`font-bold ${Number(r.amount_open) > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {fmtRp(r.amount_open)}
              </span>
            ),
          },
          { key: "due_date", label: "Jatuh Tempo", render: (r) => fmtDate(r.due_date) },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                r.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {r.status}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                onClick={() => setViewRow(r)}
                className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                title="Lihat Detail Tagihan"
              >
                <Eye size={13} />
              </button>
            ),
          },
        ]}
      />

      {viewRow && (
        <Modal
          title={`Detail Tagihan Vendor: ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
          maxWidth="sm:max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Nama Vendor:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{viewRow.vendor_name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Ref GRN: {viewRow.receipt_no}</div>
              </div>
              <div>
                <span className="text-gray-500">Status Pembayaran:</span>
                <div className={`font-bold text-sm mt-0.5 uppercase ${viewRow.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                  {viewRow.status}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Jatuh Tempo: {fmtDate(viewRow.due_date)}</div>
              </div>
            </div>

            <div className="rounded-xl border p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Nilai Tagihan Bruto:</span>
                <span className="font-semibold text-gray-900">{fmtRp(viewRow.amount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">Sisa Hutang Terbuka (Open):</span>
                <span className={`font-bold ${Number(viewRow.amount_open) > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {fmtRp(viewRow.amount_open)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setViewRow(null)} className={btnSecondary}>
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


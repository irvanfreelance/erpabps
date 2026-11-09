"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtRp } from "@/lib/utils/format";
import { Eye } from "lucide-react";
import { btnSecondary } from "@/components/ui/button";

export type VendorPaymentRow = {
  id: string;
  doc_no: string;
  bill_no: string;
  vendor_name: string;
  fund_name: string;
  amount: number | string;
  paid_on: string;
  status: string;
};

export function VendorPaymentsManager({ rows }: { rows: VendorPaymentRow[] }) {
  const [viewRow, setViewRow] = useState<VendorPaymentRow | null>(null);

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        exportFilename="Bukti Pelunasan Vendor"
        columns={[
          { key: "doc_no", label: "No. Bukti Bayar", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "bill_no", label: "Ref Tagihan" },
          { key: "vendor_name", label: "Vendor Penerima", render: (r) => <span className="font-medium text-gray-900">{r.vendor_name}</span> },
          { key: "fund_name", label: "Sumber Kas", render: (r) => <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{r.fund_name}</span> },
          { key: "amount", label: "Jumlah Dibayar", numeric: true, render: (r) => <span className="font-bold text-emerald-800">{fmtRp(r.amount)}</span> },
          { key: "paid_on", label: "Tanggal Bayar", render: (r) => fmtDate(r.paid_on) },
          { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                onClick={() => setViewRow(r)}
                className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                title="Lihat Detail Bukti Bayar"
              >
                <Eye size={13} />
              </button>
            ),
          },
        ]}
      />

      {viewRow && (
        <Modal
          title={`Detail Pelunasan Vendor: ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
          maxWidth="sm:max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Vendor Penerima:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{viewRow.vendor_name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Ref Tagihan: {viewRow.bill_no}</div>
              </div>
              <div>
                <span className="text-gray-500">Sumber Kas:</span>
                <div className="font-semibold text-amber-800 mt-0.5">{viewRow.fund_name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Dibayar Pada: {fmtDate(viewRow.paid_on)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 flex justify-between items-center">
              <div>
                <div className="text-emerald-950 font-semibold">Total Nilai Kas Keluar:</div>
                <div className="text-[11px] text-emerald-700">Pelunasan belanja all-in bahan baku dapur</div>
              </div>
              <div className="text-base font-bold text-emerald-800">{fmtRp(viewRow.amount)}</div>
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

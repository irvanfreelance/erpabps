"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtRp, fmtQty } from "@/lib/utils/format";
import { Eye } from "lucide-react";
import { btnSecondary } from "@/components/ui/button";

export type GoodsReceiptRow = {
  id: string;
  doc_no: string;
  po_no: string;
  bin_name: string;
  status: string;
  freight_cost: number | string;
  other_cost: number | string;
  posted_at: string;
  lines?: Array<{
    id: number;
    item_name: string;
    sku: string;
    qty: number;
    unit_cost: number;
    goods_value: number;
    all_in_value: number;
  }>;
};

export function GoodsReceiptsManager({ rows }: { rows: GoodsReceiptRow[] }) {
  const [viewRow, setViewRow] = useState<GoodsReceiptRow | null>(null);

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        exportFilename="Penerimaan Barang GRN"
        columns={[
          { key: "doc_no", label: "No. GRN", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "po_no", label: "Ref PO" },
          { key: "bin_name", label: "Masuk ke Bin", render: (r) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">{r.bin_name}</span> },
          { key: "freight_cost", label: "Ongkir All-in", numeric: true, render: (r) => fmtRp(r.freight_cost) },
          { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
          { key: "posted_at", label: "Waktu Penerimaan" },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                onClick={() => setViewRow(r)}
                className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                title="Lihat Detail Penerimaan & HPP"
              >
                <Eye size={13} />
              </button>
            ),
          },
        ]}
      />

      {viewRow && (
        <Modal
          title={`Detail Penerimaan Barang (GRN): ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
          maxWidth="sm:max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Nomor PO:</span>
                <div className="font-bold text-gray-900 mt-0.5">{viewRow.po_no || "-"}</div>
              </div>
              <div>
                <span className="text-gray-500">Bin Penerimaan:</span>
                <div className="font-semibold text-gray-800 mt-0.5">{viewRow.bin_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Biaya Ongkir Ekstra:</span>
                <div className="font-bold text-amber-700 mt-0.5">{fmtRp(viewRow.freight_cost)}</div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-800 mb-2">Item Barang yang Diterima & Alokasi HPP All-in:</div>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="py-2 px-3">Barang / SKU</th>
                      <th className="py-2 px-3 text-right">Kuantitas</th>
                      <th className="py-2 px-3 text-right">Harga Beli</th>
                      <th className="py-2 px-3 text-right">Nilai Total All-in</th>
                      <th className="py-2 px-3 text-right">HPP Bersih / Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(viewRow.lines || []).map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-gray-900">{l.item_name}</div>
                          <div className="text-[10px] text-gray-400">{l.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{fmtQty(l.qty)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{fmtRp(l.goods_value)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-800">{fmtRp(l.all_in_value)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">{fmtRp(l.unit_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

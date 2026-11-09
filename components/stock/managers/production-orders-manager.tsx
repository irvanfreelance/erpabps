"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtRp, fmtQty } from "@/lib/utils/format";
import { Eye } from "lucide-react";
import { btnSecondary } from "@/components/ui/button";

export type ProductionOrderRow = {
  id: string;
  doc_no: string;
  output_qty: number | string;
  total_cost: number | string;
  output_item_name: string;
  output_bin_name: string;
  status: string;
  ingredients?: Array<{
    id: number;
    item_name: string;
    sku: string;
    qty: number;
  }>;
};

export function ProductionOrdersManager({ rows }: { rows: ProductionOrderRow[] }) {
  const [viewRow, setViewRow] = useState<ProductionOrderRow | null>(null);

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        exportFilename="Perintah Produksi"
        columns={[
          { key: "doc_no", label: "No. MO", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "output_item_name", label: "Barang Hasil Olahan", render: (r) => <span className="font-bold text-gray-800">{r.output_item_name}</span> },
          { key: "output_qty", label: "Hasil Produksi", numeric: true, render: (r) => <span className="font-semibold text-emerald-800">{fmtQty(r.output_qty)} kg</span> },
          { key: "total_cost", label: "Total Biaya HPP", numeric: true, render: (r) => <span className="font-bold text-purple-800">{fmtRp(r.total_cost)}</span> },
          { key: "output_bin_name", label: "Masuk ke Bin", render: (r) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">{r.output_bin_name}</span> },
          { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                onClick={() => setViewRow(r)}
                className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                title="Lihat Detail Resep & Konsumsi Bahan"
              >
                <Eye size={13} />
              </button>
            ),
          },
        ]}
      />

      {viewRow && (
        <Modal
          title={`Detail Perintah Produksi Dapur: ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
          maxWidth="sm:max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Hasil Olahan:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">
                  {fmtQty(viewRow.output_qty)} kg {viewRow.output_item_name}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Masuk ke: {viewRow.output_bin_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Total HPP Produksi:</span>
                <div className="font-bold text-purple-800 text-sm mt-0.5">{fmtRp(viewRow.total_cost)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  HPP per kg: {fmtRp(Number(viewRow.total_cost) / Number(viewRow.output_qty))}
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-800 mb-2">Bahan Baku Mentah yang Dikonsumsi (Dipotong):</div>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="py-2 px-3">Bahan Mentah</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3 text-right">Kuantitas Terpakai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(viewRow.ingredients || []).map((ing, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-medium text-gray-900">{ing.item_name}</td>
                        <td className="py-2.5 px-3 text-gray-500">{ing.sku}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-800">{fmtQty(ing.qty)}</td>
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


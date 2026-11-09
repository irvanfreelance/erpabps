"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtQty } from "@/lib/utils/format";
import { Eye } from "lucide-react";
import { btnSecondary } from "@/components/ui/button";

export type StockCountRow = {
  id: string;
  doc_no: string;
  bin_name: string;
  status: string;
  counted_on: string;
  creator_name: string;
  lines?: Array<{
    id: number;
    item_name: string;
    sku: string;
    qty_system: number;
    qty_count: number;
    variance: number;
  }>;
};

export function StockCountsManager({ rows }: { rows: StockCountRow[] }) {
  const [viewRow, setViewRow] = useState<StockCountRow | null>(null);

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        exportFilename="Stock Opname Fisik"
        columns={[
          { key: "doc_no", label: "No. Opname", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "bin_name", label: "Lokasi Bin", render: (r) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">{r.bin_name}</span> },
          { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
          { key: "counted_on", label: "Tanggal Hitung", render: (r) => fmtDate(r.counted_on) },
          { key: "creator_name", label: "Petugas Opname" },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                onClick={() => setViewRow(r)}
                className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                title="Lihat Detail Opname"
              >
                <Eye size={13} />
              </button>
            ),
          },
        ]}
      />

      {viewRow && (
        <Modal
          title={`Detail Stock Opname: ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
          maxWidth="sm:max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Lokasi Bin Dihitung:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{viewRow.bin_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Tanggal Pelaksanaan:</span>
                <div className="font-semibold text-gray-800 mt-0.5">{fmtDate(viewRow.counted_on)}</div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-800 mb-2">Perbandingan Fisik vs Sistem:</div>
              <table className="w-full text-left border rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-1.5 px-3">Barang</th>
                    <th className="py-1.5 px-3 text-right">Qty Sistem</th>
                    <th className="py-1.5 px-3 text-right">Qty Fisik</th>
                    <th className="py-1.5 px-3 text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewRow.lines || []).map((l, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium">{l.item_name}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{fmtQty(l.qty_system)}</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900">{fmtQty(l.qty_count)}</td>
                      <td className={`py-2 px-3 text-right font-bold ${l.variance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {fmtQty(l.variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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


"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtRp, fmtQty } from "@/lib/utils/format";
import { Eye } from "lucide-react";
import { btnSecondary } from "@/components/ui/button";

export type SalesInvoiceRow = {
  id: string;
  doc_no: string;
  party_name: string;
  amount: number | string;
  cogs_amount: number | string;
  laba: number | string;
  margin_achieved_pct: number | string;
  status: string;
  lines?: Array<{
    id: number;
    item_name: string;
    sku: string;
    qty: number;
    unit_cost: number;
    unit_price: number;
    line_amount: number;
    cogs_value: number;
  }>;
};

export function SalesInvoicesManager({ rows }: { rows: SalesInvoiceRow[] }) {
  const [viewRow, setViewRow] = useState<SalesInvoiceRow | null>(null);

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        exportFilename="Faktur Penjualan dan Margin"
        columns={[
          { key: "doc_no", label: "No. Faktur", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "party_name", label: "Pelanggan / Kanal", render: (r) => <span className="font-medium text-blue-800">{r.party_name}</span> },
          { key: "amount", label: "Total Omzet", numeric: true, render: (r) => <span className="font-bold text-gray-900">{fmtRp(r.amount)}</span> },
          { key: "cogs_amount", label: "HPP Keluar", numeric: true, render: (r) => <span className="text-gray-500">{fmtRp(r.cogs_amount)}</span> },
          { key: "laba", label: "Laba Kotor", numeric: true, render: (r) => <span className="font-bold text-emerald-600">{fmtRp(r.laba)}</span> },
          {
            key: "margin_achieved_pct",
            label: "Margin Realisasi",
            render: (r) => (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                +{Number(r.margin_achieved_pct).toFixed(0)}%
              </span>
            ),
          },
          { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                onClick={() => setViewRow(r)}
                className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                title="Lihat Rincian Faktur & Margin"
              >
                <Eye size={13} />
              </button>
            ),
          },
        ]}
      />

      {viewRow && (
        <Modal
          title={`Detail Faktur Penjualan: ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
          maxWidth="sm:max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Pelanggan / Kanal:</span>
                <div className="font-bold text-gray-900 mt-0.5">{viewRow.party_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Total Omzet Penjualan:</span>
                <div className="font-bold text-blue-800 text-sm mt-0.5">{fmtRp(viewRow.amount)}</div>
              </div>
              <div>
                <span className="text-gray-500">Laba Tercapai:</span>
                <div className="font-bold text-emerald-700 text-sm mt-0.5">
                  {fmtRp(viewRow.laba)} (+{Number(viewRow.margin_achieved_pct).toFixed(0)}%)
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-800 mb-2">Item Barang yang Difakturkan:</div>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="py-2 px-3">Produk</th>
                      <th className="py-2 px-3 text-right">Kuantitas</th>
                      <th className="py-2 px-3 text-right">HPP Satuan</th>
                      <th className="py-2 px-3 text-right">Harga Jual</th>
                      <th className="py-2 px-3 text-right">Total Tagihan</th>
                      <th className="py-2 px-3 text-right">Laba Satuan</th>
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
                        <td className="py-2.5 px-3 text-right text-gray-500">{fmtRp(l.unit_cost)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{fmtRp(l.unit_price)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-800">{fmtRp(l.line_amount)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {fmtRp(Number(l.unit_price) - Number(l.unit_cost))}
                        </td>
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

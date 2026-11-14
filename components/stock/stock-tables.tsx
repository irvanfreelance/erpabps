"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnSecondary } from "@/components/ui/button";
import { fmtDate, fmtQty, fmtRp } from "@/lib/utils/format";

// 1. Purchase Requests
export type PurchaseRequestRow = {
  id: string;
  doc_no: string;
  source_unit: string;
  status: string;
  needed_on: string;
  creator_name: string;
  posted_at: string;
  line_count: number;
};

export function PurchaseRequestsTable({ rows }: { rows: PurchaseRequestRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Permintaan Belanja"
      columns={[
        { key: "doc_no", label: "No. Dokumen" },
        { key: "source_unit", label: "Unit Asal", render: (r) => <span className="uppercase font-semibold text-xs">{r.source_unit}</span> },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "needed_on", label: "Dibutuhkan Pada", render: (r) => fmtDate(r.needed_on) },
        { key: "line_count", label: "Jml Item", numeric: true },
        { key: "creator_name", label: "Dibuat Oleh" },
        { key: "posted_at", label: "Waktu Posting" },
      ]}
    />
  );
}

// 2. Purchase Orders
export type PurchaseOrderRow = {
  id: string;
  doc_no: string;
  request_no: string | null;
  vendor_name: string;
  item_count: number;
  status: string;
  creator_name: string;
  posted_at: string;
  lines?: Array<{ id: number; item_name: string; sku: string; qty: number; price_hint: number | null }> | null;
};

export function PurchaseOrdersTable({ rows }: { rows: PurchaseOrderRow[] }) {
  const [viewRow, setViewRow] = useState<PurchaseOrderRow | null>(null);
  return (
    <>
    <DataTable
      data={rows}
      exportFilename="Pesanan Beli"
      columns={[
        { key: "doc_no", label: "No. PO" },
        { key: "request_no", label: "Ref Request", render: (r) => r.request_no || "-" },
        { key: "vendor_name", label: "Vendor" },
        { key: "item_count", label: "Jumlah Item", numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Purchasing Staff" },
        { key: "posted_at", label: "Waktu Posting" },
        {
          key: "actions",
          label: "Aksi",
          render: (r) => (
            <button type="button" onClick={() => setViewRow(r)} className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50" title="Lihat detail pesanan">
              <Eye size={13} />
            </button>
          ),
        },
      ]}
    />
    {viewRow && (
      <Modal title={`Detail Pesanan Beli: ${viewRow.doc_no}`} onClose={() => setViewRow(null)}>
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div><span className="text-gray-500">Vendor</span><div className="font-semibold text-gray-900">{viewRow.vendor_name}</div></div>
            <div><span className="text-gray-500">Permintaan</span><div className="font-semibold text-gray-900">{viewRow.request_no || "—"}</div></div>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-gray-700"><tr><th className="px-3 py-2">Barang</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Perkiraan harga</th></tr></thead>
            <tbody>
              {(viewRow.lines || []).map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2">{line.item_name}<div className="text-[10px] text-gray-400">{line.sku}</div></td>
                  <td className="px-3 py-2 text-right">{fmtQty(line.qty)}</td>
                  <td className="px-3 py-2 text-right">{line.price_hint == null ? "—" : fmtRp(line.price_hint)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end"><button type="button" className={btnSecondary} onClick={() => setViewRow(null)}>Tutup</button></div>
        </div>
      </Modal>
    )}
    </>
  );
}

// 3. Goods Receipts
export type GoodsReceiptRow = {
  id: string;
  doc_no: string;
  po_no: string;
  bin_name: string;
  goods_total: number;
  freight_cost: number;
  all_in_total: number;
  hpp_method: string;
  status: string;
  posted_at: string;
};

export function GoodsReceiptsTable({ rows }: { rows: GoodsReceiptRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Penerimaan Barang"
      columns={[
        { key: "doc_no", label: "No. GRN" },
        { key: "po_no", label: "No. PO" },
        { key: "bin_name", label: "Gudang Masuk" },
        { key: "goods_total", label: "Nilai Barang", render: (r) => fmtRp(r.goods_total), numeric: true },
        { key: "freight_cost", label: "Ongkir Dialokasi", render: (r) => fmtRp(r.freight_cost), numeric: true },
        { key: "all_in_total", label: "Total All-In HPP", render: (r) => <span className="font-bold text-emerald-700">{fmtRp(r.all_in_total)}</span>, numeric: true },
        { key: "hpp_method", label: "Metode HPP", render: (r) => <span className="uppercase text-xs">{r.hpp_method}</span> },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "posted_at", label: "Waktu Penerimaan" },
      ]}
    />
  );
}

// 4. Vendor Bills
export type VendorBillRow = {
  id: string;
  doc_no: string;
  grn_no: string;
  vendor_name: string;
  amount: number;
  amount_open: number;
  due_date: string;
  status: string;
};

export function VendorBillsTable({ rows }: { rows: VendorBillRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Hutang Vendor"
      columns={[
        { key: "doc_no", label: "No. Tagihan" },
        { key: "grn_no", label: "Ref GRN" },
        { key: "vendor_name", label: "Nama Vendor" },
        { key: "amount", label: "Total Tagihan", render: (r) => fmtRp(r.amount), numeric: true },
        { key: "amount_open", label: "Sisa Hutang", render: (r) => <span className={Number(r.amount_open) > 0 ? "font-bold text-red-600" : "text-emerald-700 font-semibold"}>{fmtRp(r.amount_open)}</span>, numeric: true },
        { key: "due_date", label: "Jatuh Tempo", render: (r) => fmtDate(r.due_date) },
        { key: "status", label: "Status", render: (r) => (
          <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {r.status === 'paid' ? 'Lunas' : 'Belum Lunas'}
          </span>
        )},
      ]}
    />
  );
}

// 5. Vendor Payments
export type VendorPaymentRow = {
  id: string;
  doc_no: string;
  bill_no: string;
  vendor_name: string;
  amount: number;
  paid_on: string;
  fund_name: string | null;
  status: string;
  creator_name: string;
};

export function VendorPaymentsTable({ rows }: { rows: VendorPaymentRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Pembayaran Vendor"
      columns={[
        { key: "doc_no", label: "No. Bayar" },
        { key: "bill_no", label: "No. Tagihan" },
        { key: "vendor_name", label: "Vendor" },
        { key: "amount", label: "Jumlah Dibayar", render: (r) => <span className="font-bold text-emerald-700">{fmtRp(r.amount)}</span>, numeric: true },
        { key: "paid_on", label: "Tanggal Bayar", render: (r) => fmtDate(r.paid_on) },
        { key: "fund_name", label: "Sumber Kas", render: (r) => r.fund_name || "Kas Umum" },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Diproses Oleh" },
      ]}
    />
  );
}

// 6. Cash Funds
export type CashFundRow = {
  id: string;
  code: string;
  name: string;
  total_topup: number;
  total_spend: number;
  balance: number;
  total_entries: number;
};

export function CashFundsTable({ rows }: { rows: CashFundRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Buku Kas Operasional"
      columns={[
        { key: "code", label: "Kode Kas" },
        { key: "name", label: "Nama Buku Kas" },
        { key: "total_topup", label: "Total Uang Masuk", render: (r) => fmtRp(r.total_topup), numeric: true },
        { key: "total_spend", label: "Total Realisasi Belanja", render: (r) => fmtRp(r.total_spend), numeric: true },
        { key: "balance", label: "Sisa Saldo Kas", render: (r) => <span className="font-bold text-emerald-800 text-sm">{fmtRp(r.balance)}</span>, numeric: true },
        { key: "total_entries", label: "Jumlah Transaksi", numeric: true },
      ]}
    />
  );
}

// 7. Production Orders
export type ProductionOrderRow = {
  id: string;
  doc_no: string;
  output_name: string;
  output_qty: number;
  uom_code: string;
  output_bin: string;
  total_cost: number;
  unit_cost: number;
  status: string;
  posted_at: string;
};

export function ProductionOrdersTable({ rows }: { rows: ProductionOrderRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Perintah Produksi"
      columns={[
        { key: "doc_no", label: "No. MO" },
        { key: "output_name", label: "Barang Hasil" },
        { key: "output_qty", label: "Kuantitas Hasil", render: (r) => `${Number(r.output_qty)} ${r.uom_code}`, numeric: true },
        { key: "output_bin", label: "Lokasi Simpan" },
        { key: "total_cost", label: "Total Biaya Bahan", render: (r) => fmtRp(r.total_cost), numeric: true },
        { key: "unit_cost", label: "HPP Satuan Hasil", render: (r) => <span className="font-bold text-purple-700">{fmtRp(r.unit_cost)} / {r.uom_code}</span>, numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "posted_at", label: "Waktu Selesai" },
      ]}
    />
  );
}

// 8. BOMs
export type BomRow = {
  id: string;
  output_name: string;
  output_qty: number;
  uom_code: string;
  material_count: number;
  effective_from: string;
  effective_to: string | null;
};

export function BomsTable({ rows }: { rows: BomRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Resep Produksi (BOM)"
      columns={[
        { key: "output_name", label: "Barang Hasil" },
        { key: "output_qty", label: "Standar Hasil", render: (r) => `${Number(r.output_qty)} ${r.uom_code}`, numeric: true },
        { key: "material_count", label: "Jumlah Komponen Bahan", numeric: true },
        { key: "effective_from", label: "Berlaku Mulai", render: (r) => fmtDate(r.effective_from) },
        { key: "effective_to", label: "Berlaku Sampai", render: (r) => r.effective_to ? fmtDate(r.effective_to) : "Seterusnya" },
      ]}
    />
  );
}

// 9. Sales Orders
export type SalesOrderRow = {
  id: string;
  doc_no: string;
  party_name: string;
  party_kind: string;
  item_count: number;
  ordered_on: string;
  status: string;
  creator_name: string;
};

export function SalesOrdersTable({ rows }: { rows: SalesOrderRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Order Penjualan"
      columns={[
        { key: "doc_no", label: "No. SO" },
        { key: "party_name", label: "Pihak Pemesan" },
        { key: "party_kind", label: "Kanal", render: (r) => <span className="uppercase text-xs font-semibold">{r.party_kind}</span> },
        { key: "item_count", label: "Item Dipesan", numeric: true },
        { key: "ordered_on", label: "Tanggal Pesan", render: (r) => fmtDate(r.ordered_on) },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Petugas" },
      ]}
    />
  );
}

// 10. Shipments
export type ShipmentRow = {
  id: string;
  doc_no: string;
  so_no: string;
  source_bin: string;
  shipped_on: string;
  total_cogs: number;
  status: string;
  posted_at: string;
  lines?: Array<{ id: number; item_name: string; sku: string; qty: number; unit_cost: number; cogs_value: number }> | null;
};

export function ShipmentsTable({ rows }: { rows: ShipmentRow[] }) {
  const [viewRow, setViewRow] = useState<ShipmentRow | null>(null);
  return (
    <>
    <DataTable
      data={rows}
      exportFilename="Pengiriman Barang"
      columns={[
        { key: "doc_no", label: "No. Surat Jalan" },
        { key: "so_no", label: "No. Order (SO)" },
        { key: "source_bin", label: "Keluar Dari Bin" },
        { key: "shipped_on", label: "Tanggal Kirim", render: (r) => fmtDate(r.shipped_on) },
        { key: "total_cogs", label: "HPP Stok Keluar", render: (r) => <span className="font-bold text-blue-700">{fmtRp(r.total_cogs)}</span>, numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "posted_at", label: "Waktu Posting" },
        {
          key: "actions",
          label: "Aksi",
          render: (r) => (
            <button type="button" onClick={() => setViewRow(r)} className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50" title="Lihat detail pengiriman">
              <Eye size={13} />
            </button>
          ),
        },
      ]}
    />
    {viewRow && (
      <Modal title={`Detail Pengiriman: ${viewRow.doc_no}`} onClose={() => setViewRow(null)}>
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div><span className="text-gray-500">Order</span><div className="font-semibold text-gray-900">{viewRow.so_no}</div></div>
            <div><span className="text-gray-500">Bin asal</span><div className="font-semibold text-gray-900">{viewRow.source_bin}</div></div>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-gray-700"><tr><th className="px-3 py-2">Barang</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">HPP</th></tr></thead>
            <tbody>
              {(viewRow.lines || []).map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2">{line.item_name}<div className="text-[10px] text-gray-400">{line.sku}</div></td>
                  <td className="px-3 py-2 text-right">{fmtQty(line.qty)}</td>
                  <td className="px-3 py-2 text-right">{fmtRp(line.cogs_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end"><button type="button" className={btnSecondary} onClick={() => setViewRow(null)}>Tutup</button></div>
        </div>
      </Modal>
    )}
    </>
  );
}

// 11. Sales Invoices
export type SalesInvoiceRow = {
  id: string;
  doc_no: string;
  shipment_no: string;
  party_name: string;
  party_kind: string;
  omzet: number;
  cogs: number;
  laba: number;
  margin_pct: number;
  status: string;
};

export function SalesInvoicesTable({ rows }: { rows: SalesInvoiceRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Faktur Penjualan"
      columns={[
        { key: "doc_no", label: "No. Faktur" },
        { key: "shipment_no", label: "No. Kirim" },
        { key: "party_name", label: "Pembeli" },
        { key: "party_kind", label: "Kanal", render: (r) => <span className="uppercase text-xs font-semibold">{r.party_kind}</span> },
        { key: "omzet", label: "Nilai Tagihan (Omzet)", render: (r) => fmtRp(r.omzet), numeric: true },
        { key: "cogs", label: "HPP Terkait", render: (r) => fmtRp(r.cogs), numeric: true },
        { key: "laba", label: "Laba Kotor", render: (r) => <span className="font-bold text-emerald-700">{fmtRp(r.laba)}</span>, numeric: true },
        { key: "margin_pct", label: "Margin", render: (r) => <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">+{Number(r.margin_pct).toFixed(0)}%</span>, numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
      ]}
    />
  );
}

// 12. Price Lists
export type PriceListRow = {
  id: string;
  code: string;
  party_kind: string;
  margin_percent: number;
  effective_from: string;
  effective_to: string | null;
};

export function PriceListsTable({ rows }: { rows: PriceListRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Daftar Harga & Margin"
      columns={[
        { key: "code", label: "Kode Daftar Harga" },
        { key: "party_kind", label: "Kanal Penerima", render: (r) => <span className="uppercase text-xs font-semibold">{r.party_kind}</span> },
        { key: "margin_percent", label: "Margin Keuntungan", render: (r) => <span className="font-bold text-emerald-700 text-sm">+{Number(r.margin_percent).toFixed(1)}%</span>, numeric: true },
        { key: "effective_from", label: "Berlaku Mulai", render: (r) => fmtDate(r.effective_from) },
        { key: "effective_to", label: "Berlaku Sampai", render: (r) => r.effective_to ? fmtDate(r.effective_to) : "Seterusnya" },
      ]}
    />
  );
}

// 13. Balances
export type StockBalanceRow = {
  id: string;
  sku: string;
  item_name: string;
  bin_name: string;
  qty: number;
  uom_code: string;
  unit_cost: number;
  value: number;
};

export function StockBalancesTable({ rows }: { rows: StockBalanceRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Saldo Persediaan"
      columns={[
        { key: "sku", label: "SKU" },
        { key: "item_name", label: "Nama Barang" },
        { key: "bin_name", label: "Lokasi Simpan (Bin)" },
        { key: "qty", label: "Kuantitas Saldo", render: (r) => `${Number(r.qty)} ${r.uom_code}`, numeric: true },
        { key: "unit_cost", label: "HPP Satuan", render: (r) => fmtRp(r.unit_cost), numeric: true },
        { key: "value", label: "Total Nilai Persediaan", render: (r) => <span className="font-bold text-emerald-800">{fmtRp(r.value)}</span>, numeric: true },
      ]}
    />
  );
}

// 14. Stock Moves
export type StockMoveRow = {
  id: string;
  move_time: string;
  item_name: string;
  bin_name: string;
  move_kind: string;
  qty: number;
  uom_code: string;
  unit_cost: number;
  value: number;
  source_type: string;
  source_id: string;
  running_qty?: number | string;
};

export function StockMovesTable({ rows }: { rows: StockMoveRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Kartu Stok Mutasi"
      columns={[
        { key: "move_time", label: "Waktu" },
        { key: "item_name", label: "Nama Barang" },
        { key: "bin_name", label: "Bin Lokasi" },
        { key: "move_kind", label: "Jenis Mutasi", render: (r) => (
          <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
            r.move_kind === 'receipt' || r.move_kind === 'produce' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {r.move_kind}
          </span>
        )},
        { key: "qty", label: "Kuantitas", render: (r) => `${Number(r.qty)} ${r.uom_code}`, numeric: true },
        { key: "unit_cost", label: "Biaya Satuan", render: (r) => fmtRp(r.unit_cost), numeric: true },
        { key: "value", label: "Total Nilai", render: (r) => fmtRp(r.value), numeric: true },
        { key: "running_qty", label: "Saldo berjalan", render: (r) => r.running_qty == null ? "—" : String(r.running_qty), numeric: true },
        { key: "source_type", label: "Dokumen Asal", render: (r) => `${r.source_type} #${r.source_id}` },
      ]}
    />
  );
}

// 15. Stock Counts
export type StockCountRow = {
  id: string;
  doc_no: string;
  bin_name: string;
  counted_on: string;
  total_lines: number;
  status: string;
  creator_name: string;
};

export function StockCountsTable({ rows }: { rows: StockCountRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Stock Opname"
      columns={[
        { key: "doc_no", label: "No. Dokumen" },
        { key: "bin_name", label: "Lokasi Bin Dihitung" },
        { key: "counted_on", label: "Tanggal Hitung", render: (r) => fmtDate(r.counted_on) },
        { key: "total_lines", label: "Item Dihitung", numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Petugas Opname" },
      ]}
    />
  );
}

// 16. Reversals
export type StockReversalRow = {
  id: string;
  doc_no: string;
  source_type: string;
  source_id: string;
  reason: string;
  creator_name: string;
  posted_at: string;
};

export function StockReversalsTable({ rows }: { rows: StockReversalRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Koreksi Pembalik"
      columns={[
        { key: "doc_no", label: "No. Pembalik" },
        { key: "source_type", label: "Dokumen Asal", render: (r) => `${r.source_type} #${r.source_id}` },
        { key: "reason", label: "Alasan Koreksi" },
        { key: "creator_name", label: "Diajukan Oleh" },
        { key: "posted_at", label: "Waktu Eksekusi" },
      ]}
    />
  );
}

// 17. Items
export type StockItemRow = {
  id: string;
  sku: string;
  name: string;
  category_name: string;
  item_kind: string;
  uom_code: string;
  uom_name: string;
  is_stocked: boolean;
};

export function StockItemsTable({ rows }: { rows: StockItemRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Katalog Barang"
      columns={[
        { key: "sku", label: "SKU / Kode" },
        { key: "name", label: "Nama Barang" },
        { key: "category_name", label: "Kategori" },
        { key: "item_kind", label: "Jenis", render: (r) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-700">
            {r.item_kind}
          </span>
        )},
        { key: "uom_code", label: "Satuan Ukur", render: (r) => `${r.uom_code} (${r.uom_name})` },
        { key: "is_stocked", label: "Dicatat Stok", render: (r) => r.is_stocked ? "Ya" : "Tidak" },
      ]}
    />
  );
}

// 18. Bins
export type StockBinRow = {
  id: string;
  code: string;
  name: string;
  bin_kind: string;
  is_receiving: boolean;
  location_name: string | null;
};

export function StockBinsTable({ rows }: { rows: StockBinRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Master Bin"
      columns={[
        { key: "code", label: "Kode Bin" },
        { key: "name", label: "Nama Bin / Ruang" },
        { key: "bin_kind", label: "Fungsi Bin", render: (r) => <span className="uppercase text-xs font-semibold">{r.bin_kind}</span> },
        { key: "is_receiving", label: "Pintu Masuk Pembelian", render: (r) => r.is_receiving ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Ya (Penerimaan Utama)</span>
        ) : "Tidak" },
        { key: "location_name", label: "Lokasi Fisik", render: (r) => r.location_name || "Dapur Pusat" },
      ]}
    />
  );
}

// 19. Parties
export type StockPartyRow = {
  id: string;
  code: string;
  name: string;
  party_kind: string;
  location_name: string | null;
};

export function StockPartiesTable({ rows }: { rows: StockPartyRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Master Mitra"
      columns={[
        { key: "code", label: "Kode Mitra" },
        { key: "name", label: "Nama Entitas / Rekanan" },
        { key: "party_kind", label: "Jenis Mitra", render: (r) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-800">
            {r.party_kind.replace(/_/g, " ")}
          </span>
        )},
        { key: "location_name", label: "Lokasi Internal", render: (r) => r.location_name || "-" },
      ]}
    />
  );
}

// 20. Categories
export type StockCategoryRow = {
  id: string;
  code: string;
  name: string;
  item_count: number;
};

export function StockCategoriesTable({ rows }: { rows: StockCategoryRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Kategori Barang"
      columns={[
        { key: "code", label: "Kode Kategori" },
        { key: "name", label: "Nama Kategori" },
        { key: "item_count", label: "Jumlah Barang Terdaftar", numeric: true },
      ]}
    />
  );
}

// 21. UoMs
export type StockUomRow = {
  id: string;
  code: string;
  name: string;
  item_count: number;
};

export function StockUomsTable({ rows }: { rows: StockUomRow[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="Satuan Ukur"
      columns={[
        { key: "code", label: "Kode Satuan" },
        { key: "name", label: "Nama Satuan" },
        { key: "item_count", label: "Dipakai di Katalog", numeric: true },
      ]}
    />
  );
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet, Check, X, Edit3 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { btnPrimary } from "@/components/ui/button";
import { fmtRp } from "@/lib/utils/format";

export type CashAdvanceRow = {
  id: string;
  employee_id: string;
  amount: string;
  installment_count: number;
  installment_amount: string;
  override_installment_amount: string | null;
  interval_unit: string;
  remaining_amount: string;
  screening_status: string;
  notes: string | null;
  requested_at_wib: string;
  full_name: string;
  employee_number: string | null;
  screened_by_name: string | null;
};

export function CashAdvancesManager({
  rows = [],
  userRole = "subordinat",
  canScreen = false,
}: {
  rows: CashAdvanceRow[];
  userRole: string;
  canScreen?: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // State Override Cicilan oleh Superadmin HR
  const [editingRow, setEditingRow] = useState<CashAdvanceRow | null>(null);
  const [overrideAmount, setOverrideAmount] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Estimasi cicilan per bulan
  const estPerMonth = Number(amount) > 0 && Number(installmentCount) > 0
    ? Math.round(Number(amount) / Number(installmentCount))
    : 0;

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    const numCount = Number(installmentCount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Nominal kasbon harus lebih dari 0");
      return;
    }
    if (!numCount || numCount <= 0) {
      toast.error("Berapa kali gajian terpotong harus minimal 1 kali");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          installmentCount: numCount,
          installmentAmount: estPerMonth,
          notes,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal mengajukan kasbon");
        return;
      }

      toast.success("Pengajuan kasbon berhasil dikirim ke Superadmin HR!");
      setAmount("");
      setInstallmentCount("1");
      setNotes("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScreen(id: string, passed: boolean) {
    try {
      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: true, id, passed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal memproses");
        return;
      }
      toast.success(passed ? "Kasbon disetujui untuk pemotongan payroll!" : "Kasbon ditolak");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    }
  }

  async function handleSaveOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRow) return;

    setSavingOverride(true);
    try {
      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          override: true,
          id: editingRow.id,
          overrideInstallmentAmount: overrideAmount ? Number(overrideAmount) : null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal menyimpan nominal override");
        return;
      }

      toast.success("Nominal potongan gajian berhasil disesuaikan!");
      setEditingRow(null);
      setOverrideAmount("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSavingOverride(false);
    }
  }

  const columns: Column<CashAdvanceRow>[] = [
    {
      key: "requested_at_wib",
      label: "Tanggal Pengajuan",
      width: "140px",
    },
    {
      key: "full_name",
      label: "Karyawan",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.full_name}</div>
          <div className="text-[11px] text-gray-400">{r.employee_number || "-"}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Total Kasbon",
      numeric: true,
      render: (r) => <span className="font-bold text-gray-900">{fmtRp(r.amount)}</span>,
    },
    {
      key: "installment_count",
      label: "Tenor",
      render: (r) => <span>{r.installment_count}x Gajian</span>,
    },
    {
      key: "installment_amount",
      label: "Potongan / Gajian",
      numeric: true,
      render: (r) => {
        const hasOverride = r.override_installment_amount != null;
        return (
          <div className="flex flex-col items-end">
            <span className={hasOverride ? "font-bold text-[var(--primary)]" : "font-medium text-gray-700"}>
              {fmtRp(hasOverride ? r.override_installment_amount : r.installment_amount)}
            </span>
            {hasOverride && (
              <span className="text-[10px] text-gray-400 line-through">
                Awal: {fmtRp(r.installment_amount)}
              </span>
            )}
            {canScreen && (
              <button
                type="button"
                onClick={() => {
                  setEditingRow(r);
                  setOverrideAmount(r.override_installment_amount || String(Math.round(Number(r.installment_amount))));
                }}
                className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <Edit3 className="h-3 w-3" />
                Ubah saat gajian
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "remaining_amount",
      label: "Sisa Kasbon",
      numeric: true,
      render: (r) => (
        <span className={Number(r.remaining_amount) > 0 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
          {fmtRp(r.remaining_amount)}
        </span>
      ),
    },
    {
      key: "screening_status",
      label: "Status Approval HR",
      render: (r) => {
        const passed = r.screening_status === "passed";
        const rejected = r.screening_status === "rejected";
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              passed
                ? "bg-emerald-100 text-emerald-800"
                : rejected
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {passed ? "Disetujui HR" : rejected ? "Ditolak HR" : "Menunggu Screening HR"}
          </span>
        );
      },
    },
    ...(canScreen
      ? ([
          {
            key: "actions",
            label: "Screening HR",
            render: (r: CashAdvanceRow) => {
              if (r.screening_status !== "submitted") {
                return (
                  <div className="text-[11px] text-gray-400">
                    Oleh: {r.screened_by_name || "Superadmin"}
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleScreen(r.id, true)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Check className="h-3 w-3" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScreen(r.id, false)}
                    className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700"
                  >
                    <X className="h-3 w-3" />
                    Tolak
                  </button>
                </div>
              );
            },
          },
        ] as Column<CashAdvanceRow>[])
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Form Pengajuan Kasbon (Atasan & Bawahan Sama-sama Mengajukan ke Superadmin HR) */}
      <form onSubmit={handleApply} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm max-w-xl space-y-4">
        <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-[16px]">
          <Wallet className="h-5 w-5" />
          <span>Form Pengajuan Kasbon</span>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Nominal Kasbon (Rp)</label>
          <input
            type="number"
            min="10000"
            step="1000"
            placeholder="Contoh: 1000000"
            className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[14px] font-semibold focus:outline-none focus:border-[var(--primary)]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">
            Dipotong Dalam Berapa Kali Gajian? (Bulan)
          </label>
          <input
            type="number"
            min="1"
            max="24"
            className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
            required
          />
          {estPerMonth > 0 && (
            <p className="mt-1 text-[12px] text-gray-500">
              Estimasi potongan: <span className="font-semibold text-gray-800">{fmtRp(estPerMonth)}</span> per bulan gajian.
            </p>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Keperluan / Catatan</label>
          <textarea
            rows={2}
            placeholder="Contoh: Keperluan perbaikan motor, kebutuhan keluarga..."
            className="w-full rounded-xl border border-gray-300 p-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? "Mengirim..." : "Kirim Pengajuan Kasbon"}
        </button>
      </form>

      {/* Tabel Riwayat Pengajuan Kasbon */}
      <div>
        <h2 className="mb-2 text-[16px] font-bold text-gray-900">Daftar Pengajuan & Cicilan Kasbon</h2>
        <DataTable data={rows} columns={columns} exportFilename={`Kasbon_${new Date().toISOString().slice(0, 10)}`} />
      </div>

      {/* Modal Override Potongan Gajian oleh HR Superadmin */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[16px] font-bold text-gray-900">Sesuaikan Potongan Gajian</h3>
            <p className="mt-1 text-[13px] text-gray-500">
              Karyawan: <span className="font-semibold text-gray-800">{editingRow.full_name}</span>
            </p>
            <p className="text-[12px] text-gray-500">
              Sisa Kasbon: <span className="font-semibold text-amber-700">{fmtRp(editingRow.remaining_amount)}</span>
            </p>

            <form onSubmit={handleSaveOverride} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Nominal Potongan Gajian Periode Ini (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  max={editingRow.remaining_amount}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-[14px] font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)]"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  placeholder="Masukkan nominal custom..."
                  required
                />
                <span className="block mt-1 text-[11px] text-gray-400">
                  Default cicilan: {fmtRp(editingRow.installment_amount)}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="flex-1 rounded-xl bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingOverride}
                  className="flex-1 rounded-xl bg-[var(--primary)] py-2 text-[13px] font-semibold text-white shadow-sm hover:opacity-95"
                >
                  {savingOverride ? "Menyimpan..." : "Simpan Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

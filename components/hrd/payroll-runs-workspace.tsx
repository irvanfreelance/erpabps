"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Plus, Wallet, Clock, ArrowRight, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

function fmtDateId(val: string | null | undefined) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export type RunRow = {
  id: string;
  pay_group_name: string;
  pay_group_code: string;
  period_start: string;
  period_end: string;
  pay_frequency: "weekly" | "monthly" | string;
  status: string;
  run_type: string;
};

export type PayGroupOption = {
  id: string;
  code: string;
  name: string;
  pay_frequency: "weekly" | "monthly" | string;
};

export function PayrollRunsWorkspace({
  runs,
  payGroups,
}: {
  runs: RunRow[];
  payGroups: PayGroupOption[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"all" | "monthly" | "weekly">("all");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"monthly" | "weekly">("monthly");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ mode: "selected" | "all"; count: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const filteredGroups = payGroups.filter((g) => g.pay_frequency === createType);
  const [selectedGroupId, setSelectedGroupId] = useState(filteredGroups[0]?.id || "");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  function openModalFor(type: "monthly" | "weekly") {
    setCreateType(type);
    const groups = payGroups.filter((g) => g.pay_frequency === type);
    setSelectedGroupId(groups[0]?.id || "");

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");

    if (type === "monthly") {
      // Default: Awal bulan s/d Akhir bulan ini
      setPeriodStart(`${y}-${m}-01`);
      const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
      setPeriodEnd(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    } else {
      // Default: 7 hari terakhir (Pekanan)
      const end = today.toISOString().slice(0, 10);
      const startObj = new Date(today);
      startObj.setDate(startObj.getDate() - 6);
      const start = startObj.toISOString().slice(0, 10);
      setPeriodStart(start);
      setPeriodEnd(end);
    }

    setOpenCreateModal(true);
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroupId || !periodStart || !periodEnd) {
      toast.error("Lengkapi seluruh field formulir");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/payroll-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payGroupId: selectedGroupId,
          periodStart,
          periodEnd,
          payFrequency: createType,
        }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !data?.id) throw new Error(data?.error || "Gagal membuat run payroll");
      toast.success(`Payroll ${createType === "monthly" ? "Bulanan" : "Pekanan"} berhasil di-generate`);
      setOpenCreateModal(false);
      router.push(`/payroll-runs/${data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  const displayedRuns = runs.filter((r) => {
    if (activeTab === "all") return true;
    return r.pay_frequency === activeTab;
  });

  const monthlyRuns = runs.filter((r) => r.pay_frequency === "monthly");
  const weeklyRuns = runs.filter((r) => r.pay_frequency === "weekly");

  async function handleBulkDelete() {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      const body =
        confirmDelete.mode === "all"
          ? { all: true, ...(activeTab !== "all" ? { payFrequency: activeTab } : {}) }
          : { ids: selectedIds };
      const res = await fetch("/api/payroll-runs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { deleted?: number; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus payroll run");
      toast.success(`${data?.deleted ?? confirmDelete.count} payroll run berhasil dihapus`);
      setSelectedIds([]);
      setConfirmDelete(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<RunRow>[] = [
    {
      key: "pay_group_name",
      label: "Kelompok Penggajian",
      render: (r) => (
        <div>
          <Link
            href={`/payroll-runs/${r.id}`}
            className="font-semibold text-[var(--primary)] hover:underline"
          >
            {r.pay_group_name}
          </Link>
          <div className="text-[11px] text-gray-400">{r.pay_group_code}</div>
        </div>
      ),
      exportValue: (r) => `${r.pay_group_name} (${r.pay_group_code})`,
    },
    {
      key: "pay_frequency",
      label: "Tipe Siklus",
      render: (r) =>
        r.pay_frequency === "monthly" ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            Bulanan (Monthly)
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
            Pekanan (Weekly)
          </span>
        ),
      exportValue: (r) => (r.pay_frequency === "monthly" ? "Bulanan (Monthly)" : "Pekanan (Weekly)"),
    },
    {
      key: "period_start",
      label: "Periode Mulai",
      render: (r) => <span className="whitespace-nowrap text-gray-700">{fmtDateId(r.period_start)}</span>,
      exportValue: (r) => fmtDateId(r.period_start),
    },
    {
      key: "period_end",
      label: "Periode Akhir",
      render: (r) => <span className="whitespace-nowrap text-gray-700">{fmtDateId(r.period_end)}</span>,
      exportValue: (r) => fmtDateId(r.period_end),
    },
    {
      key: "status",
      label: "Status",
      render: (r) =>
        r.status === "approved" || r.status === "paid" ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
            Approved / Beku
          </span>
        ) : r.status === "calculated" ? (
          <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-medium text-sky-800">
            Terkalkulasi
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
            Draft
          </span>
        ),
      exportValue: (r) =>
        r.status === "approved" || r.status === "paid"
          ? "Approved / Beku"
          : r.status === "calculated"
            ? "Terkalkulasi"
            : "Draft",
    },
    {
      key: "actions",
      label: "Aksi",
      includeInExport: false,
      sticky: "right",
      render: (r) => (
        <Link
          href={`/payroll-runs/${r.id}`}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
        >
          Periksa & Hitung
          <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Action Cards Header: Pemisah Jelas Bulanan & Pekanan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                <Calendar className="h-3.5 w-3.5" />
                Gajian Bulanan (Monthly)
              </div>
              <h3 className="mt-2 text-[16px] font-bold text-gray-900">Payroll Outlet & Office</h3>
              <p className="mt-1 text-[12px] text-gray-600">
                Gaji bulanan reguler outlet, tunjangan kehadiran & transport, insentif tgl merah, dan cicilan kasbon.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openModalFor("monthly")}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 text-[12px] font-medium text-white shadow hover:bg-emerald-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Generate Bulanan
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500">
            <span>Total Run: <strong>{monthlyRuns.length}</strong></span>
            <span>·</span>
            <span>Kelompok: {payGroups.filter((g) => g.pay_frequency === "monthly").map((g) => g.name).join(", ")}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                <Clock className="h-3.5 w-3.5" />
                Gajian Pekanan (Weekly)
              </div>
              <h3 className="mt-2 text-[16px] font-bold text-gray-900">Payroll Crew Dapur</h3>
              <p className="mt-1 text-[12px] text-gray-600">
                Penggajian berbasis jam hadir riil mingguan (clock-in/out raw × hourly_rate) tanpa denda telat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openModalFor("weekly")}
              className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-[12px] font-medium text-white shadow hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Generate Pekanan
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500">
            <span>Total Run: <strong>{weeklyRuns.length}</strong></span>
            <span>·</span>
            <span>Kelompok: {payGroups.filter((g) => g.pay_frequency === "weekly").map((g) => g.name).join(", ")}</span>
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
            activeTab === "all"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Semua Run ({runs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("monthly")}
          className={`border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
            activeTab === "monthly"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Bulanan ({monthlyRuns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("weekly")}
          className={`border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
            activeTab === "weekly"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Pekanan ({weeklyRuns.length})
        </button>
      </div>

      {/* Bulk Delete Toolbar */}
      {displayedRuns.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDelete({ mode: "selected", count: selectedIds.length })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Terpilih ({selectedIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete({ mode: "all", count: displayedRuns.length })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus Semua ({displayedRuns.length})
          </button>
        </div>
      )}

      {/* Standard DataTable */}
      <DataTable
        columns={columns}
        data={displayedRuns}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        exportFilename={`Payroll_Runs_${activeTab}_${new Date().toISOString().slice(0, 10)}`}
      />

      {/* Modal Konfirmasi Hapus Bulk */}
      {confirmDelete && (
        <Modal
          title="Konfirmasi Hapus Payroll Run"
          onClose={() => !deleting && setConfirmDelete(null)}
        >
          <div className="space-y-4">
            <p className="text-[13px] text-gray-700">
              Anda yakin ingin menghapus{" "}
              <span className="font-semibold text-red-600">{confirmDelete.count}</span> payroll run
              {confirmDelete.mode === "all" && activeTab !== "all"
                ? ` (${activeTab === "monthly" ? "Bulanan" : "Pekanan"})`
                : ""}
              ? Semua item rincian gaji dan snapshot pada run tersebut juga akan ikut terhapus dan
              tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className={btnSecondary}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Generate Run Baru Terpisah */}
      {openCreateModal && (
        <Modal
          title={`Generate Payroll Baru — Siklus ${createType === "monthly" ? "Bulanan" : "Pekanan"}`}
          onClose={() => setOpenCreateModal(false)}
        >
          <form onSubmit={handleCreateRun} className="space-y-3 text-[13px]">
            <div className="rounded border bg-gray-50 p-2.5 text-[12px] text-gray-600">
              Siklus Penggajian:{" "}
              <strong className="text-gray-900">
                {createType === "monthly" ? "BULANAN (Monthly Split)" : "PEKANAN (Weekly Hourly)"}
              </strong>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700">
                Pilih Kelompok Gaji ({createType})
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
              >
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Tanggal Mulai Periode
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Tanggal Selesai Periode
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setOpenCreateModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className={btnPrimary}
              >
                Generate & Kalkulasi
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


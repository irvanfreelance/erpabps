"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Plus, Users, Sparkles, CheckCircle } from "lucide-react";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export type BonusPoolRow = {
  id: string;
  pool_kind: string;
  period_start: string;
  period_end: string;
  pool_amount: string;
  status: string;
  pay_group_name: string | null;
  location_name: string | null;
};

export type BonusAllocRow = {
  bonus_pool_id: string;
  employee_id: string;
  full_name: string;
  employee_number: string | null;
  component_code: string;
  amount: string;
  reason: string | null;
};

export function MonthlyBonusWorkspace({
  pools,
  allocations,
  payGroups,
}: {
  pools: BonusPoolRow[];
  allocations: BonusAllocRow[];
  payGroups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [poolAmount, setPoolAmount] = useState(4000000); // 4 Juta
  const [noLateBonus, setNoLateBonus] = useState(100000); // 100 Ribu
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState(5); // < 5 Menit
  const [noLeaveBonus, setNoLeaveBonus] = useState(100000); // 100 Ribu
  const [remainderPopulation, setRemainderPopulation] = useState<"all" | "qualified">("all");
  const [payGroupId, setPayGroupId] = useState(payGroups[0]?.id || "");
  const [periodStart, setPeriodStart] = useState("2026-10-01");
  const [periodEnd, setPeriodEnd] = useState("2026-10-31");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/bonus-pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolKind: "monthly_component",
          poolAmount: Number(poolAmount),
          noLateBonus: Number(noLateBonus),
          lateThresholdMinutes: Number(lateThresholdMinutes),
          noLeaveBonus: Number(noLeaveBonus),
          remainderPopulation,
          payGroupId: payGroupId || null,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat pool bonus");
      toast.success("Pool bonus berhasil dibuat dan alokasi dihitung otomatis!");
      setOpenModal(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  const formatRupiah = (val: string | number) =>
    `Rp ${Number(val).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      {/* Header Info & Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 p-1 text-amber-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-[15px] font-bold text-amber-950">
              Pengaturan Bonus Tambahan Berkomponen (Dinamis)
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-amber-800">
            HR Superadmin dapat menyetel total pool bonus (misal Rp4 Juta), alokasi Rp100rb bagi yang tidak telat (ambang di bawah 5 menit tetap dapat), Rp100rb bagi yang hadir penuh tanpa izin, dan sisanya otomatis dibagi rata.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow hover:bg-amber-700"
        >
          <Plus className="h-4 w-4" />
          Buat Pool & Hitung Alokasi
        </button>
      </div>

      {/* Daftar Pool Bonus */}
      <div className="space-y-2">
        <h3 className="text-[14px] font-bold text-gray-800">Riwayat Pool Bonus Bulanan</h3>
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b bg-[var(--primary)] text-[12px] font-semibold text-white">
              <tr>
                <th className="px-3 py-2.5">ID Pool</th>
                <th className="px-3 py-2.5">Kelompok Gaji</th>
                <th className="px-3 py-2.5">Periode</th>
                <th className="px-3 py-2.5 text-right">Total Pool Dana</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    Belum ada pool bonus bulanan yang dibuat.
                  </td>
                </tr>
              ) : (
                pools.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-semibold text-gray-900">Pool #{p.id}</td>
                    <td className="px-3 py-2.5 text-gray-700">{p.pay_group_name || "Semua Kelompok"}</td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {p.period_start} s/d {p.period_end}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                      {formatRupiah(p.pool_amount)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rincian Alokasi Bonus per Karyawan */}
      <div className="space-y-2">
        <h3 className="text-[14px] font-bold text-gray-800">
          Rincian Alokasi Bonus per Karyawan (Masuk Otomatis ke Payroll)
        </h3>
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b bg-[var(--primary)] text-[12px] font-semibold text-white">
              <tr>
                <th className="px-3 py-2.5">Karyawan</th>
                <th className="px-3 py-2.5">Komponen Bonus</th>
                <th className="px-3 py-2.5">Alasan / Dasar Perhitungan</th>
                <th className="px-3 py-2.5 text-right">Nominal Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    Belum ada alokasi bonus. Klik &quot;Buat Pool &amp; Hitung Alokasi&quot; untuk mengalkulasi bonus.
                  </td>
                </tr>
              ) : (
                allocations.map((a, idx) => (
                  <tr key={`${a.bonus_pool_id}-${a.employee_id}-${a.component_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      <div>{a.full_name}</div>
                      <div className="text-[11px] text-gray-400">{a.employee_number || "-"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-800">
                        {a.component_code === "no_late"
                          ? "Disiplin Tepat Waktu"
                          : a.component_code === "no_leave"
                          ? "Kehadiran Penuh (Tanpa Izin)"
                          : "Bagi Rata Sisa Pool"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600">{a.reason || "-"}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                      {formatRupiah(a.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Setup Pool & Breakdown */}
      {openModal && (
        <Modal
          title="Setup Pool & Alokasi Bonus Bulanan Dinamis"
          onClose={() => setOpenModal(false)}
        >
          <form onSubmit={handleCreate} className="space-y-3 text-[13px]">
            <div>
              <label className="block text-[12px] font-medium text-gray-700">
                Pilih Kelompok Gaji
              </label>
              <select
                value={payGroupId}
                onChange={(e) => setPayGroupId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
              >
                {payGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Periode Mulai
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
                  Periode Akhir
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

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
              <h4 className="text-[12px] font-bold text-amber-900">
                Skema Breakdown Bonus (Dinamis)
              </h4>

              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Total Dana Pool Bonus (Rp)
                </label>
                <input
                  type="number"
                  step={50000}
                  value={poolAmount}
                  onChange={(e) => setPoolAmount(Number(e.target.value))}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700">
                    Bonus Disiplin Telat (Rp)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={noLateBonus}
                    onChange={(e) => setNoLateBonus(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700">
                    Toleransi Telat (Menit)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={lateThresholdMinutes}
                    onChange={(e) => setLateThresholdMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                  />
                  <span className="text-[10px] text-gray-500">
                    Di bawah {lateThresholdMinutes} menit tetap dapat bonus
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Bonus Kehadiran Penuh / Tanpa Izin (Rp)
                </label>
                <input
                  type="number"
                  step={10000}
                  value={noLeaveBonus}
                  onChange={(e) => setNoLeaveBonus(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Pembagian Sisa Pool Dana
                </label>
                <select
                  value={remainderPopulation}
                  onChange={(e) => setRemainderPopulation(e.target.value as "all" | "qualified")}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                >
                  <option value="all">Dibagi rata ke SEMUA anggota kelompok</option>
                  <option value="qualified">Hanya yang lolos salah satu komponen</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setOpenModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className={btnPrimary}
              >
                Hitung & Alokasikan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


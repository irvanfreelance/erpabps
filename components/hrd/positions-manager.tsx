"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/hrd/modal";
import { DataTable } from "@/components/data-table/data-table";
import { btnDangerSm, btnPrimary, btnSecondary } from "@/components/ui/button";

type Row = { id: string; code: string; name: string; payroll_type: string; department_name: string; department_id?: string };
type Dept = { id: string; name: string };

export function PositionsManager({ rows, departments }: { rows: Row[]; departments: Dept[] }) {
  const router = useRouter();
  const empty = { code: "", name: "", departmentId: departments[0]?.id ?? "", payrollType: "monthly_split" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);

  async function save() {
    const url = editing ? `/api/positions/${editing}` : "/api/positions";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan jabatan");
      return;
    }
    toast.success("Tersimpan");
    setEditing(null);
    setForm(empty);
    setOpenModal(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirmAction("Hapus jabatan ini?", "Hapus"))) return;
    const res = await fetch(`/api/positions/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Gagal");
    else {
      toast.success("Diarsipkan");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setEditing(null);
            setForm(empty);
            setOpenModal(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Tambah Jabatan
        </button>
      </div>
      {openModal && (
        <Modal
          title={editing ? "Ubah Jabatan" : "Tambah Jabatan"}
          onClose={() => {
            setOpenModal(false);
            setEditing(null);
            setForm(empty);
          }}
        >
          <div className="grid gap-3">
        <input className="min-h-11 rounded-xl border px-3" placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="min-h-11 rounded-xl border px-3" placeholder="Nama jabatan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="min-h-11 rounded-xl border px-3" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select className="min-h-11 rounded-xl border px-3" value={form.payrollType} onChange={(e) => setForm({ ...form, payrollType: e.target.value })}>
          <option value="monthly_split">Bulanan</option>
          <option value="weekly_hourly">Mingguan jam</option>
        </select>
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={save}>
            {editing ? "Ubah" : "Tambah"}
          </button>
          {editing && (
            <button type="button" className={btnSecondary} onClick={() => { setEditing(null); setForm(empty); }}>
              Batal
            </button>
          )}
        </div>
          </div>
        </Modal>
      )}
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "department_name", label: "Departemen" },
          { key: "payroll_type", label: "Tipe" },
          {
            key: "id",
            label: "Aksi",
            render: (r) => (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 hover:bg-sky-100"
                  onClick={() => {
                    setEditing(r.id);
                    setOpenModal(true);
                    setForm({
                      code: r.code,
                      name: r.name,
                      departmentId: departments.find((d) => d.name === r.department_name)?.id ?? "",
                      payrollType: r.payroll_type,
                    });
                  }}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button type="button" className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100" onClick={() => remove(r.id)}>
                  <Trash2 className="h-3 w-3" /> Hapus
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

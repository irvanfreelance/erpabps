import { GET as list } from "@/app/api/employee-types/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Jenis Karyawan" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; code: string; name: string; description: string | null }[] }>(
    await list(),
  );
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Master jenis karyawan</h1>
      <p className="mb-4 text-[13px] text-gray-500">
        Konfigurasi kategori jenis karyawan untuk penentuan skema presensi dan payroll (Dapur = upah per jam fleksibel, Outlet = roster shift, Office = reguler).
      </p>
      <SimpleCreate
        action="/api/employee-types"
        label="Tambah jenis"
        fields={[
          { name: "code", label: "Kode (contoh: magang, harian)" },
          { name: "name", label: "Nama jenis karyawan" },
          { name: "description", label: "Keterangan" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "description", label: "Keterangan" },
        ]}
      />
    </div>
  );
}

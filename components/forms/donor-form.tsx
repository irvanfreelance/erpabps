"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";
import { btnBlock, btnPrimary, btnSecondary } from "@/components/ui/button";

export function DonorCreateButton() {
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();

  async function submit() {
    const res = await fetch("/api/donors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namaLengkap: nama, noHpCanonical: phone, email: email || null }),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan donatur");
      return;
    }
    toast.success("Donatur dibuat");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={`${btnPrimary} ${btnBlock}`} onClick={() => setOpen(true)}>
        + Tambah
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-xl bg-white p-5 sm:max-w-[400px] sm:rounded-xl">
            <h3 className="mt-0 mb-3 text-primary">Donatur baru</h3>
            <label className="mb-1 block text-[12px] font-medium text-[#8a8a8a]">Nama</label>
            <input className="mb-2 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={nama} onChange={(e) => setNama(e.target.value)} />
            <label className="mb-1 block text-[12px] font-medium text-[#8a8a8a]">No. HP</label>
            <input className="mb-2 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <label className="mb-1 block text-[12px] font-medium text-[#8a8a8a]">Email</label>
            <input className="mb-3 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>Batal</button>
              <button type="button" className={btnPrimary} onClick={submit}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DonorIdentityForm({
  donorId,
  nama,
  email,
  status,
}: {
  donorId: string;
  nama: string;
  email: string;
  status: string;
}) {
  const router = useRouter();
  const [namaLengkap, setNamaLengkap] = useState(nama);
  const [mail, setMail] = useState(email);
  const [statusKontak, setStatusKontak] = useState(status);

  async function save() {
    const res = await fetch(`/api/donors/${donorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namaLengkap,
        email: mail || null,
        statusKontak,
      }),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan profil");
      return;
    }
    toast.success("Profil donatur tersimpan");
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-[#eee] pt-3">
      <div className="grid grid-cols-1 gap-2">
        <label className="block text-[12px]">
          <span className="mb-1 block font-medium text-[#8a8a8a]">Nama</span>
          <input className="min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} />
        </label>
        <label className="block text-[12px]">
          <span className="mb-1 block font-medium text-[#8a8a8a]">Email</span>
          <input className="min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={mail} onChange={(e) => setMail(e.target.value)} />
        </label>
        <label className="block text-[12px]">
          <span className="mb-1 block font-medium text-[#8a8a8a]">Status</span>
          <SearchSelect
            allowClear={false}
            value={statusKontak}
            options={["aktif", "mati", "diblokir", "opt_out"].map((v) => ({ value: v, label: v }))}
            onChange={setStatusKontak}
          />
        </label>
      </div>
      <button type="button" className={`mt-3 ${btnPrimary} ${btnBlock}`} onClick={() => void save()}>
        Simpan profil
      </button>
    </div>
  );
}

export function ProspectNoteForm({ donorId }: { donorId: string }) {
  const [catatan, setCatatan] = useState("");
  const [respon, setRespon] = useState("merespon");
  const router = useRouter();
  return (
    <form
      className="mb-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/api/prospect-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ donorId, responDonatur: respon, catatanBebas: catatan }),
        });
        setCatatan("");
        toast.success("Catatan tersimpan");
        router.refresh();
      }}
    >
      <SearchSelect
        className="sm:w-52"
        value={respon}
        allowClear={false}
        options={["belum_merespon", "hanya_read", "merespon", "closing", "gagal", "opt_out"].map((x) => ({
          value: x,
          label: x,
        }))}
        onChange={setRespon}
      />
      <input className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan" />
      <button className={`${btnPrimary} ${btnBlock}`} type="submit">
        Catat
      </button>
    </form>
  );
}

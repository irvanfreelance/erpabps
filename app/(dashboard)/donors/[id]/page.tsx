import Link from "next/link";
import { ArrowLeft, CircleDot, Target, Wallet } from "lucide-react";
import { btnBlock, btnSecondary } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { DonorIdentityForm, ProspectNoteForm } from "@/components/forms/donor-form";
import { DonorDynamicFieldsForm } from "@/components/forms/donor-dynamic-fields";
import { DonorTagsEditor } from "@/components/forms/donor-tags";
import { Badge } from "@/components/shared/badge";
import { GET as getDonor } from "@/app/api/donors/[id]/route";
import { GET as listDynamic } from "@/app/api/donors/[id]/dynamic/route";
import { GET as listNotes } from "@/app/api/donors/[id]/notes/route";
import { GET as listTags } from "@/app/api/tags/route";
import { GET as listTransactions } from "@/app/api/transactions/route";
import { fromRoute, internalRequest, RouteError } from "@/lib/api/from-route";
import { parseTagSlugs } from "@/lib/org/field-value";
import { fmtRp, toNum } from "@/lib/utils/format";
import { notFound } from "next/navigation";

export const metadata = { title: "Profil Donatur — CRM RN", description: "Detail donatur" };

export default async function DonorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = { params: Promise.resolve({ id }) };
  let donor: Record<string, unknown>;
  try {
    donor = await fromRoute<Record<string, unknown>>(await getDonor(internalRequest(`/api/donors/${id}`), ctx));
  } catch (err) {
    if (err instanceof RouteError && err.status === 404) notFound();
    throw err;
  }
  const [trxRes, notesRes, dynRes, tagsRes] = await Promise.all([
    listTransactions(internalRequest(`/api/transactions?donorId=${id}`)).then((res) =>
      fromRoute<{ rows: Array<Record<string, unknown>> }>(res),
    ),
    listNotes(internalRequest(`/api/donors/${id}/notes`), ctx).then((res) =>
      fromRoute<{ rows: Array<Record<string, unknown>> }>(res),
    ),
    listDynamic(internalRequest(`/api/donors/${id}/dynamic`), ctx).then((res) => fromRoute<{ rows: never[] }>(res)),
    listTags().then((res) => fromRoute<{ rows: Array<{ slug: string; nama: string; warna: string }> }>(res)),
  ]);
  const trx = trxRes.rows;
  const notes = notesRes.rows;
  const dynRows = dynRes.rows;
  const catalog = tagsRes.rows;

  return (
    <div>
      <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <Link href="/donors" className={`${btnSecondary} ${btnBlock}`}>
          <ArrowLeft size={16} />
          Kembali
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 text-[18px] font-bold break-words text-[var(--primary)] md:text-[20px]">{String(donor.nama_lengkap)}</h1>
          <Badge>{String(donor.status_kontak)}</Badge>
          {donor.segmen_rfm ? <Badge>{String(donor.segmen_rfm)}</Badge> : null}
        </div>
      </div>
      <div className="mb-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[10px] bg-white p-[18px] shadow-sm">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-[#888]">
            <CircleDot size={12} /> IDENTITAS
          </div>
          <dl className="grid gap-2.5">
            <Fact label="No. HP" value={String(donor.no_hp_canonical)} />
            <Fact label="Email" value={String(donor.email ?? "—")} />
            <Fact label="PIC" value={String(donor.assigned_nama ?? "—")} />
          </dl>
          <DonorIdentityForm
            donorId={id}
            nama={String(donor.nama_lengkap ?? "")}
            email={String(donor.email ?? "")}
            status={String(donor.status_kontak ?? "aktif")}
          />
        </div>
        <div className="rounded-[10px] bg-white p-[18px] shadow-sm">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-[#888]">
            <Wallet size={12} /> DONASI
          </div>
          <dl className="grid gap-2.5">
            <Fact label="Total" value={fmtRp(toNum(donor.total_donation_lifetime))} />
            <Fact label="Transaksi" value={`${String(donor.total_donation_count)}x`} />
            <Fact label="Program" value={String(donor.last_donation_program_nama ?? "—")} />
          </dl>
        </div>
        <div className="rounded-[10px] bg-white p-[18px] shadow-sm">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-[#888]">
            <Target size={12} /> SKOR RFM
          </div>
          <div className="mt-3 flex justify-around">
            {[
              ["Recency", donor.skor_r],
              ["Frequency", donor.skor_f],
              ["Monetary", donor.skor_m],
            ].map(([l, v]) => (
              <div key={String(l)} className="text-center">
                <div className="text-[11px] font-medium text-[#8a8a8a]">{String(l)}</div>
                <div className="text-[26px] font-bold leading-none text-[var(--primary)]">{String(v ?? "-")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DonorTagsEditor donorId={id} tags={parseTagSlugs(donor.tags)} catalog={catalog} />
      <DonorDynamicFieldsForm donorId={id} rows={dynRows} />
      <h2 className="text-[15px] font-bold text-primary">Transaksi</h2>
      <DataTable
        data={trx.map((r) => ({
          ...r,
          nominal: fmtRp(toNum(r.nominal)),
        })) as never[]}
        columns={[
          { key: "tgl_transaksi", label: "Tanggal" },
          { key: "program_nama", label: "Program" },
          { key: "campaign_nama", label: "Campaign" },
          { key: "nominal", label: "Nominal", numeric: true },
          { key: "status", label: "Status" },
        ]}
      />
      <h2 className="mt-4 text-[15px] font-bold text-primary">Prospect notes</h2>
      <ProspectNoteForm donorId={id} />
      <DataTable
        data={notes as never[]}
        columns={[
          { key: "tgl_prospek", label: "Tgl" },
          { key: "user_nama", label: "PIC" },
          { key: "respon_donatur", label: "Respon" },
          { key: "catatan_bebas", label: "Catatan" },
          { key: "source", label: "Sumber" },
        ]}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-[#8a8a8a]">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-normal text-[#5c5c5c]">{value}</dd>
    </div>
  );
}

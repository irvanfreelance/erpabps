import { AppConfigTable } from "@/components/forms/app-config-table";
import { OrgSettingsForm } from "@/components/forms/org-settings-form";
import { GET as listAppConfig } from "@/app/api/app-config/route";
import { GET as getOrgProfile } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export const metadata = { title: "Pengaturan lembaga", description: "Identitas dan konfigurasi operasional" };

export default async function Page() {
  const [org, config] = await Promise.all([
    getOrgProfile()
      .then((res) => fromRoute<OrgProfile>(res))
      .catch(() => fallbackOrg()),
    listAppConfig().then((res) => fromRoute<{ rows: Array<{ key: string; value: string; description: string | null }> }>(res)),
  ]);
  const rows = config.rows;
  return (
    <div>
      <h1 className="mt-0 mb-1 text-[20px] font-bold text-[var(--primary)]">Pengaturan lembaga</h1>
      <p className="mb-4 text-[13px] text-[#666]">Nama, logo, dan warna dipakai di seluruh aplikasi. Nilai operasional di bawah bisa diubah langsung di tabel.</p>
      <OrgSettingsForm org={org} />
      <AppConfigTable rows={rows} />
    </div>
  );
}

import { OrgSettingsForm } from "@/components/forms/org-settings-form";
import { GET as getOrg } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export const metadata = { title: "Lembaga" };

export default async function Page() {
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrg());
  } catch {
    org = fallbackOrg();
  }
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Pengaturan lembaga</h1>
      <OrgSettingsForm org={org} />
    </div>
  );
}

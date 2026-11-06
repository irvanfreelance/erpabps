import { LoginScreen } from "@/components/auth/login-screen";
import { GET as getOrgProfile } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export const metadata = { title: "Masuk — CRM RN", description: "Masuk ke CRM dengan Google" };

export default async function LoginPage() {
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrgProfile());
  } catch {
    org = fallbackOrg();
  }
  return <LoginScreen org={org} />;
}

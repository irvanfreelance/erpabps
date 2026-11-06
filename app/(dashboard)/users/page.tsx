import { UsersManager } from "@/components/forms/users-manager";
import { GET as listUsers } from "@/app/api/users/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Pengguna — ABPS", description: "Pengguna sistem" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: never[] }>(await listUsers());
  return <UsersManager rows={rows} />;
}

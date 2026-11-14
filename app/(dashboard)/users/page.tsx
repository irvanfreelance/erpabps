import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { UsersManager } from "@/components/forms/users-manager";
import { GET as listUsers } from "@/app/api/users/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Pengguna", description: "Pengguna sistem" };

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/employees");

  const { rows } = await fromRoute<{ rows: never[] }>(await listUsers());
  return <UsersManager rows={rows} />;
}

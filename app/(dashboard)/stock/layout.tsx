import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/employees");

  return <>{children}</>;
}


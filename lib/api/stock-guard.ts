import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";

/**
 * Memastikan request hanya bisa diakses oleh role superadmin.
 * Superordinat dan subordinat ditolak 403 Forbidden.
 */
export async function guardStockApi() {
  const session = await getServerSession();
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Silakan masuk terlebih dahulu." },
        { status: 401 }
      ),
      session: null,
    };
  }

  if (session.user.role !== "superadmin") {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden. Modul stok dan HPP hanya dapat diakses oleh superadmin." },
        { status: 403 }
      ),
      session: null,
    };
  }

  return { errorResponse: null, session };
}


import { postStockAction } from "@/lib/stock/handle";
import { postVendorPayment } from "@/lib/stock/posting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return postStockAction(req, "vendor_payments", postVendorPayment);
}

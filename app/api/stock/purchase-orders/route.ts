import { postStockAction } from "@/lib/stock/handle";
import { postPurchaseOrder } from "@/lib/stock/posting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return postStockAction(req, "purchase_orders", postPurchaseOrder);
}

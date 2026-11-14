import { postStockAction } from "@/lib/stock/handle";
import { postSalesInvoice } from "@/lib/stock/posting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return postStockAction(req, "sales_invoices", postSalesInvoice);
}

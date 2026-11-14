import assert from "node:assert/strict";
import pg from "pg";
import {
  postCashTopup,
  postGoodsReceipt,
  postProduction,
  postPurchaseOrder,
  postReversal,
  postSalesInvoice,
  postShipment,
  postStockCount,
  postVendorBill,
  postVendorPayment,
  StockPostError,
} from "../lib/stock/posting";
import type { SqlClient } from "../lib/db";

const client = new pg.Client({
  host: "127.0.0.1",
  user: "postgres",
  password: "postgres",
  database: "erpabps",
});

function makeSql(db: pg.Client) {
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = "";
    const params: unknown[] = [];
    strings.forEach((part, i) => {
      text += part;
      if (i < values.length) {
        const value = values[i] as { __unsafe?: boolean; sql?: string };
        if (value && typeof value === "object" && value.__unsafe) {
          text += value.sql;
        } else {
          params.push(values[i]);
          text += `$${params.length}`;
        }
      }
    });
    const res = await db.query(text, params);
    return res.rows;
  };
  sql.unsafe = (raw: string) => ({ __unsafe: true, sql: raw });
  return sql as unknown as SqlClient;
}

async function main() {
  await client.connect();
  await client.query("BEGIN");
  const sql = makeSql(client);
  const actor = String((await client.query("SELECT id FROM users WHERE role = 'superadmin' ORDER BY id LIMIT 1")).rows[0].id);

  const before = await client.query(`
    SELECT
      (SELECT COALESCE(SUM(all_in_value),0) FROM goods_receipt_lines) AS purchases,
      (SELECT COALESCE(SUM(value),0) FROM stock_balances) AS stock,
      (SELECT COALESCE(SUM(cogs_value),0) FROM shipment_lines) AS cogs,
      (SELECT balance FROM cash_funds WHERE code = 'KAS_DAPUR') AS cash
  `);
  const base = before.rows[0];
  assert.equal(Number(base.purchases), 672000);
  assert.equal(Number(base.stock), 401520);
  assert.equal(Number(base.cogs), 270480);
  assert.equal(Number(base.cash), 1328000);

  const asOfJan = await client.query(`
    SELECT COALESCE(SUM(
      CASE move_kind
        WHEN 'receipt' THEN value WHEN 'produce' THEN value
        WHEN 'consume' THEN -value WHEN 'ship' THEN -value
        ELSE value END
    ),0)::numeric AS stock
    FROM stock_moves
    WHERE created_at < (('2026-01-02'::date + 1) AT TIME ZONE 'Asia/Jakarta')
  `);
  assert.equal(Number(asOfJan.rows[0].stock), 0);

  const vendor = (await client.query("SELECT id FROM stock_parties WHERE code = 'VENDOR_CONTOH'")).rows[0].id;
  const ayam = (await client.query("SELECT id FROM stock_items WHERE sku = 'AYAM_UTUH'")).rows[0].id;
  const bin = (await client.query("SELECT id FROM stock_bins WHERE code = 'GUDANG'")).rows[0].id;
  const freezer = (await client.query("SELECT id FROM stock_bins WHERE code = 'FREEZER'")).rows[0].id;
  const fund = (await client.query("SELECT id FROM cash_funds WHERE code = 'KAS_DAPUR'")).rows[0].id;
  const bom = (await client.query("SELECT id FROM stock_boms ORDER BY id LIMIT 1")).rows[0].id;
  const outlet = (await client.query("SELECT id FROM stock_parties WHERE code = 'OUTLET_INTERNAL'")).rows[0].id;
  const ungkep = (await client.query("SELECT id FROM stock_items WHERE sku = 'AYAM_UNGKEP'")).rows[0].id;

  const po = await postPurchaseOrder(sql, actor, {
    doc_no: "PO-CYCLE",
    vendor_id: vendor,
    lines: [{ item_id: ayam, qty: 2, price_hint: 10000 }],
  });
  const grn = await postGoodsReceipt(sql, actor, {
    doc_no: "GRN-CYCLE",
    order_id: po,
    bin_id: bin,
    freight_cost: 1000,
    other_cost: 0,
    lines: [{ item_id: ayam, qty: 2, unit_price: 10000 }],
  });
  const bill = await postVendorBill(sql, actor, {
    doc_no: "BILL-CYCLE",
    receipt_id: grn,
    due_date: "2026-11-20",
  });
  await postCashTopup(sql, actor, { fund_id: fund, amount: 50000, memo: "Uang muka uji siklus" });
  await postVendorPayment(sql, actor, {
    doc_no: "PAY-CYCLE",
    bill_id: bill,
    fund_id: fund,
    amount: 21000,
    paid_on: "2026-11-20",
  });
  await postProduction(sql, actor, {
    doc_no: "MO-CYCLE",
    bom_id: bom,
    output_qty: 1,
    source_bin_id: bin,
    output_bin_id: freezer,
  });

  await client.query(
    `INSERT INTO sales_orders (doc_no, party_id, status, ordered_on, created_by)
     VALUES ('SO-CYCLE', $1, 'draft', '2026-11-20', $2)`,
    [outlet, actor],
  );
  const so = (await client.query("SELECT id FROM sales_orders WHERE doc_no = 'SO-CYCLE'")).rows[0].id;
  await client.query(`INSERT INTO sales_order_lines (order_id, item_id, qty) VALUES ($1, $2, 1)`, [so, ungkep]);
  const ship = await postShipment(sql, actor, {
    doc_no: "DO-CYCLE",
    order_id: so,
    bin_id: freezer,
    shipped_on: "2026-11-20",
    lines: [{ item_id: ungkep, qty: 1 }],
  });
  await postSalesInvoice(sql, actor, { doc_no: "INV-CYCLE", shipment_id: ship });

  const bumbu = (await client.query("SELECT id FROM stock_items WHERE sku = 'BUMBU'")).rows[0].id;
  const bumbuQty = Number(
    (await client.query("SELECT qty FROM stock_balances WHERE item_id = $1 AND bin_id = $2", [bumbu, bin])).rows[0].qty,
  );
  await postStockCount(sql, actor, {
    doc_no: "OPN-CYCLE",
    bin_id: bin,
    counted_on: "2026-11-20",
    lines: [{ item_id: bumbu, qty_count: bumbuQty }],
  });

  const after = await client.query(`
    SELECT
      (SELECT amount_open FROM vendor_bills WHERE doc_no = 'BILL-CYCLE') AS open_bill,
      (SELECT status FROM vendor_bills WHERE doc_no = 'BILL-CYCLE') AS bill_status,
      (SELECT balance FROM cash_funds WHERE code = 'KAS_DAPUR') AS cash,
      (SELECT COALESCE(SUM(value),0) FROM stock_balances) AS stock,
      (SELECT COALESCE(SUM(all_in_value),0) FROM goods_receipt_lines grl JOIN goods_receipts gr ON gr.id = grl.receipt_id WHERE gr.doc_no = 'GRN-CYCLE') AS buy,
      (SELECT amount FROM sales_invoices WHERE doc_no = 'INV-CYCLE') AS omzet,
      (SELECT cogs_amount FROM sales_invoices WHERE doc_no = 'INV-CYCLE') AS inv_cogs,
      (SELECT SUM(CASE move_kind WHEN 'receipt' THEN value WHEN 'produce' THEN value WHEN 'consume' THEN -value WHEN 'ship' THEN -value ELSE value END)
         FROM stock_moves) AS move_stock
  `);
  const row = after.rows[0];
  assert.equal(Number(row.buy), 21000);
  assert.equal(Number(row.open_bill), 0);
  assert.equal(row.bill_status, "paid");
  assert.equal(Number(row.cash), 1328000 + 50000 - 21000);
  assert.equal(Math.round(Number(row.stock)), Math.round(Number(row.move_stock)));
  assert.ok(Number(row.omzet) > Number(row.inv_cogs));
  const profit = Number(row.omzet) - Number(row.inv_cogs);
  console.log("cycle ok", {
    buy: Number(row.buy),
    cash: Number(row.cash),
    stock: Number(row.stock),
    omzet: Number(row.omzet),
    cogs: Number(row.inv_cogs),
    profit,
  });

  await assert.rejects(
    () => postReversal(sql, actor, { doc_no: "REV-GRN", source_type: "goods_receipt", source_id: grn, reason: "masih ada bayar" }),
    (err: unknown) => err instanceof StockPostError && /pembayaran/i.test(err.message),
  );
  const inv = (await client.query("SELECT id FROM sales_invoices WHERE doc_no = 'INV-CYCLE'")).rows[0].id;
  await postReversal(sql, actor, { doc_no: "REV-INV", source: `sales_invoice:${inv}`, reason: "uji faktur" });
  await postReversal(sql, actor, { doc_no: "REV-DO", source_type: "shipment", source_id: ship, reason: "uji kirim" });
  const restored = Number((await client.query("SELECT COALESCE(SUM(value),0) AS v FROM stock_balances")).rows[0].v);
  assert.equal(restored, Number(row.stock) + Number(row.inv_cogs));
  console.log("reversal ok", { restored });

  await client.query("ROLLBACK");
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await client.query("ROLLBACK");
    await client.end();
  } catch {
    /* already closed */
  }
  process.exit(1);
});

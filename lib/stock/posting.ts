import type { SqlClient } from "@/lib/db";
import { resolveSetting } from "@/lib/hrd/settings";
import {
  allocateExtra,
  asNumber,
  fifoIssueValue,
  movingAverageIssueValue,
  replayLayers,
  roundMoney,
  roundQty,
  type CostMethod,
  type FreightMethod,
} from "@/lib/stock/money";

type SqlTag = SqlClient & { unsafe: (raw: string) => unknown };

export class StockPostError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Body = Record<string, unknown>;
type RawLine = Record<string, unknown>;

const BALANCE_CTE = `
dlt AS (
  SELECT
    (x->>'item_id')::bigint AS item_id,
    (x->>'bin_id')::bigint AS bin_id,
    (x->>'qty_delta')::numeric AS qty_delta,
    (x->>'value_delta')::numeric AS value_delta,
    (x->>'expected_qty')::numeric AS expected_qty,
    (x->>'expected_value')::numeric AS expected_value,
    x->>'move_kind' AS move_kind,
    (x->>'move_qty')::numeric AS move_qty,
    (x->>'move_value')::numeric AS move_value
  FROM payload
  CROSS JOIN LATERAL jsonb_array_elements(payload.p->'deltas') x
),
upd AS (
  UPDATE stock_balances b
  SET qty = b.qty + d.qty_delta,
      value = b.value + d.value_delta,
      unit_cost = CASE
        WHEN b.qty + d.qty_delta > 0 THEN (b.value + d.value_delta) / (b.qty + d.qty_delta)
        ELSE 0
      END
  FROM dlt d
  WHERE b.item_id = d.item_id
    AND b.bin_id = d.bin_id
    AND b.qty = d.expected_qty
    AND b.value = d.expected_value
    AND b.qty + d.qty_delta >= -0.0000001
    AND b.value + d.value_delta >= -0.009
  RETURNING b.item_id
),
insb AS (
  INSERT INTO stock_balances (item_id, bin_id, qty, value, unit_cost)
  SELECT d.item_id, d.bin_id, d.qty_delta, d.value_delta,
         CASE WHEN d.qty_delta > 0 THEN d.value_delta / d.qty_delta ELSE 0 END
  FROM dlt d
  WHERE d.expected_qty = 0
    AND d.expected_value = 0
    AND d.qty_delta >= -0.0000001
    AND d.value_delta >= -0.009
    AND NOT EXISTS (
      SELECT 1 FROM stock_balances b
      WHERE b.item_id = d.item_id AND b.bin_id = d.bin_id
    )
  RETURNING item_id
),
moves AS (
  INSERT INTO stock_moves (item_id, bin_id, move_kind, qty, value, unit_cost, source_type, source_id)
  SELECT d.item_id, d.bin_id, d.move_kind, d.move_qty, d.move_value,
         CASE WHEN d.move_qty <> 0 THEN abs(d.move_value / d.move_qty) ELSE 0 END,
         (SELECT p->>'move_source' FROM payload p),
         (SELECT id FROM ins)
  FROM dlt d
  RETURNING id
)
`;

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function mapStockDbError(err: unknown): StockPostError {
  const e = err as { code?: string; message?: string };
  const msg = e.message ?? (err instanceof Error ? err.message : "");
  if (e.code === "P0001" || msg.includes("P0001")) {
    const clean = msg
      .replace(/^[\s\S]*?ERROR:\s*/i, "")
      .split("\n")[0]
      .replace(/\s*CODE:\s*P0001[\s\S]*$/i, "")
      .trim();
    return new StockPostError(400, clean || "Posting ditolak");
  }
  if (e.code === "23505" || /duplicate key/i.test(msg)) {
    return new StockPostError(409, "Nomor dokumen sudah dipakai");
  }
  if (e.code === "23514" || /ck_fund_nonneg|ck_balance_nonneg|ck_bill_open|ck_all_in/i.test(msg)) {
    return new StockPostError(400, "Saldo stok, kas, atau hutang tidak mencukupi");
  }
  if (e.code === "23503") return new StockPostError(400, "Referensi dokumen atau master tidak ditemukan");
  if (/stock_fail/i.test(msg) && /does not exist/i.test(msg)) {
    return new StockPostError(500, "Fungsi posting belum terpasang. Jalankan npm run db:migrate.");
  }
  console.error("stock post failed", err);
  return new StockPostError(500, "Gagal memposting dokumen");
}

function docNo(value: unknown) {
  const doc = String(value ?? "").trim().toUpperCase();
  if (!doc || doc.length > 40) throw new StockPostError(400, "Nomor dokumen wajib diisi (maksimal 40 karakter)");
  return doc;
}

function idOf(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new StockPostError(400, `${label} tidak valid`);
  return n;
}

function dateOf(value: unknown, label: string) {
  const s = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new StockPostError(400, `${label} wajib format tanggal`);
  return s;
}

function qtyOf(value: unknown) {
  const n = roundQty(Number(value));
  if (!(n > 0)) throw new StockPostError(400, "Kuantitas harus lebih dari nol");
  return n;
}

function moneyOf(value: unknown, label: string) {
  const n = roundMoney(Number(value));
  if (!(n >= 0) || !Number.isFinite(n)) throw new StockPostError(400, `${label} tidak valid`);
  return n;
}

function rawLines(body: Body) {
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw new StockPostError(400, "Minimal satu baris barang");
  }
  return body.lines as RawLine[];
}

async function stockSettings(sql: SqlClient) {
  const day = todayJakarta();
  const hpp = await resolveSetting(sql, "stock.hpp_method", day, {});
  const freight = await resolveSetting(sql, "stock.freight_allocation", day, {});
  const labor = await resolveSetting(sql, "stock.roll_labor_into_hpp", day, {});
  const method: CostMethod = hpp.value === "fifo" ? "fifo" : "moving_average";
  const alloc: FreightMethod =
    freight.value === "by_qty" || freight.value === "none" ? (freight.value as FreightMethod) : "by_value";
  return { method, alloc, rollLabor: labor.value === true, day };
}

async function marginFor(sql: SqlClient, partyKind: string, onDate: string) {
  const key =
    partyKind === "catering"
      ? "stock.margin.catering"
      : partyKind === "third_party_outlet"
        ? "stock.margin.third_party_outlet"
        : "stock.margin.internal_outlet";
  const setting = await resolveSetting(sql, key, onDate, {});
  const fallback = Number(setting.value ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

type OnHand = { qty: string; value: string };

async function onHandMap(sql: SqlClient, pairs: Array<{ item_id: number; bin_id: number }>) {
  const rows = (await sql`
    SELECT item_id, bin_id, qty::text AS qty, value::text AS value
    FROM stock_balances
    WHERE (item_id, bin_id) IN (
      SELECT (x->>'item_id')::bigint, (x->>'bin_id')::bigint
      FROM jsonb_array_elements(${JSON.stringify(pairs)}::jsonb) x
    )
  `) as Array<{ item_id: string; bin_id: string; qty: string; value: string }>;
  const map = new Map<string, OnHand>();
  for (const row of rows) map.set(`${row.item_id}:${row.bin_id}`, { qty: row.qty, value: row.value });
  return map;
}

function hand(map: Map<string, OnHand>, itemId: number, binId: number): OnHand {
  return map.get(`${itemId}:${binId}`) ?? { qty: "0", value: "0" };
}

async function costOut(
  sql: SqlClient,
  method: CostMethod,
  itemId: number,
  binId: number,
  qty: number,
  held: OnHand,
) {
  const qtyOnHand = asNumber(held.qty);
  const valueOnHand = asNumber(held.value);
  if (qty > qtyOnHand + 1e-9) {
    throw new StockPostError(400, "Stok tidak mencukupi untuk pengeluaran ini");
  }
  if (method === "fifo") {
    const moves = (await sql`
      SELECT move_kind, qty::numeric AS qty, value::numeric AS value
      FROM stock_moves
      WHERE item_id = ${itemId} AND bin_id = ${binId}
      ORDER BY created_at, id
    `) as Array<{ move_kind: string; qty: string; value: string }>;
    const layers = replayLayers(moves.map((m) => ({ move_kind: m.move_kind, qty: asNumber(m.qty), value: asNumber(m.value) })));
    const covered = layers.reduce((sum, layer) => sum + layer.qty, 0);
    if (covered + 1e-6 >= qty) return fifoIssueValue(layers, qty);
  }
  return movingAverageIssueValue(qtyOnHand, valueOnHand, qty);
}

function delta(input: {
  itemId: number;
  binId: number;
  qtyDelta: number;
  valueDelta: number;
  held: OnHand;
  moveKind: string;
  moveQty: number;
  moveValue: number;
}) {
  return {
    item_id: input.itemId,
    bin_id: input.binId,
    qty_delta: input.qtyDelta,
    value_delta: input.valueDelta,
    expected_qty: input.held.qty,
    expected_value: input.held.value,
    move_kind: input.moveKind,
    move_qty: input.moveQty,
    move_value: input.moveValue,
  };
}

async function execute(_sql: SqlClient, statement: PromiseLike<readonly { id?: unknown }[]>) {
  try {
    const rows = await statement;
    const id = rows[0]?.id;
    if (!id) throw new StockPostError(400, "Posting tidak menghasilkan dokumen");
    return String(id);
  } catch (err) {
    if (err instanceof StockPostError) throw err;
    throw mapStockDbError(err);
  }
}

function guardBalance(tag: SqlTag) {
  return tag.unsafe(`
    WHEN (SELECT count(*) FROM ins) = 0 THEN stock_fail('Dokumen tidak dapat diposting')
    WHEN (SELECT count(*) FROM dlt) = 0 THEN stock_fail('Tidak ada mutasi stok')
    WHEN (SELECT count(*) FROM moves) <> (SELECT count(*) FROM dlt)
      OR (SELECT count(*) FROM upd) + (SELECT count(*) FROM insb) <> (SELECT count(*) FROM dlt)
      THEN stock_fail('Saldo stok berubah atau tidak mencukupi. Muat ulang lalu coba lagi.')
  `);
}

export async function postPurchaseOrder(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  const vendorId = idOf(body.vendor_id, "Vendor");
  const requestId = body.request_id ? idOf(body.request_id, "Permintaan belanja") : null;
  const lines = rawLines(body).map((line) => ({
    item_id: idOf(line.item_id, "Barang"),
    qty: qtyOf(line.qty),
    price_hint: line.price_hint == null || line.price_hint === "" ? null : moneyOf(line.price_hint, "Perkiraan harga"),
  }));
  const payload = { doc_no: doc, vendor_id: vendorId, request_id: requestId, lines };
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      vendor_ok AS (
        SELECT sp.id FROM stock_parties sp, payload
        WHERE sp.id = (payload.p->>'vendor_id')::bigint
          AND sp.party_kind = 'vendor' AND sp.deleted_at IS NULL
      ),
      ins AS (
        INSERT INTO purchase_orders (doc_no, request_id, vendor_id, status, source_unit, created_by, posted_at)
        SELECT payload.p->>'doc_no',
               NULLIF(payload.p->>'request_id', '')::bigint,
               (SELECT id FROM vendor_ok),
               'posted', 'purchasing', ${actor}::bigint, now()
        FROM payload
        WHERE (SELECT id FROM vendor_ok) IS NOT NULL
        RETURNING id
      ),
      line_ins AS (
        INSERT INTO purchase_order_lines (order_id, item_id, qty, price_hint)
        SELECT ins.id, (x->>'item_id')::bigint, (x->>'qty')::numeric, NULLIF(x->>'price_hint', '')::numeric
        FROM ins
        CROSS JOIN payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM line_ins) = 0 THEN stock_fail('Vendor tidak valid atau baris pesanan kosong')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postGoodsReceipt(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  const orderId = idOf(body.order_id, "Pesanan beli");
  const binId = idOf(body.bin_id, "Bin penerimaan");
  const freight = moneyOf(body.freight_cost ?? 0, "Ongkir");
  const other = moneyOf(body.other_cost ?? 0, "Biaya lain");
  const { method, alloc } = await stockSettings(sql);
  const inputs = rawLines(body).map((line) => {
    const qty = qtyOf(line.qty);
    const unitPrice = moneyOf(line.unit_price, "Harga satuan");
    return { item_id: idOf(line.item_id, "Barang"), qty, goods_value: roundMoney(qty * unitPrice) };
  });
  if (inputs.some((line) => line.goods_value <= 0)) {
    throw new StockPostError(400, "Nilai barang penerimaan harus lebih dari nol");
  }
  const merged = new Map<number, { item_id: number; qty: number; goods_value: number }>();
  for (const line of inputs) {
    const prev = merged.get(line.item_id);
    if (prev) {
      prev.qty = roundQty(prev.qty + line.qty);
      prev.goods_value = roundMoney(prev.goods_value + line.goods_value);
    } else merged.set(line.item_id, { ...line });
  }
  const allocated = allocateExtra([...merged.values()], roundMoney(freight + other), alloc);
  const held = await onHandMap(sql, allocated.map((line) => ({ item_id: line.item_id, bin_id: binId })));
  const deltas = allocated.map((line) => {
    const row = hand(held, line.item_id, binId);
    return delta({
      itemId: line.item_id,
      binId,
      qtyDelta: line.qty,
      valueDelta: line.all_in_value,
      held: row,
      moveKind: "receipt",
      moveQty: line.qty,
      moveValue: line.all_in_value,
    });
  });
  const payload = {
    doc_no: doc,
    order_id: orderId,
    bin_id: binId,
    freight_cost: freight,
    other_cost: other,
    hpp_method: method,
    lines: allocated,
    deltas,
    move_source: "goods_receipt",
  };
  const tag = sql as SqlTag;
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      po_ok AS (
        SELECT po.id FROM purchase_orders po, payload
        WHERE po.id = (payload.p->>'order_id')::bigint AND po.status = 'posted'
          AND NOT EXISTS (
            SELECT 1 FROM stock_reversals r
            WHERE r.source_type = 'purchase_order' AND r.source_id = po.id
          )
      ),
      bin_ok AS (
        SELECT b.id FROM stock_bins b, payload
        WHERE b.id = (payload.p->>'bin_id')::bigint AND b.is_receiving = TRUE AND b.deleted_at IS NULL
      ),
      missing AS (
        SELECT 1
        FROM payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        WHERE NOT EXISTS (
          SELECT 1 FROM purchase_order_lines pol
          WHERE pol.order_id = (payload.p->>'order_id')::bigint
            AND pol.item_id = (x->>'item_id')::bigint
        )
      ),
      over_qty AS (
        SELECT 1
        FROM payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        JOIN purchase_order_lines pol
          ON pol.order_id = (payload.p->>'order_id')::bigint
         AND pol.item_id = (x->>'item_id')::bigint
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(grl.qty), 0) AS qty
          FROM goods_receipt_lines grl
          JOIN goods_receipts gr ON gr.id = grl.receipt_id
          WHERE gr.order_id = pol.order_id AND gr.status = 'posted' AND grl.item_id = pol.item_id
            AND NOT EXISTS (
              SELECT 1 FROM stock_reversals r
              WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id
            )
        ) got ON TRUE
        WHERE (x->>'qty')::numeric + got.qty > pol.qty + 0.0000001
      ),
      ins AS (
        INSERT INTO goods_receipts (doc_no, order_id, bin_id, status, hpp_method, freight_cost, other_cost, created_by, posted_at)
        SELECT payload.p->>'doc_no', (payload.p->>'order_id')::bigint, (payload.p->>'bin_id')::bigint,
               'posted', payload.p->>'hpp_method',
               (payload.p->>'freight_cost')::numeric, (payload.p->>'other_cost')::numeric,
               ${actor}::bigint, now()
        FROM payload
        WHERE (SELECT count(*) FROM po_ok) = 1
          AND (SELECT count(*) FROM bin_ok) = 1
          AND (SELECT count(*) FROM missing) = 0
          AND (SELECT count(*) FROM over_qty) = 0
        RETURNING id
      ),
      line_ins AS (
        INSERT INTO goods_receipt_lines (receipt_id, item_id, qty, goods_value, allocated_extra, all_in_value, unit_cost)
        SELECT ins.id, (x->>'item_id')::bigint, (x->>'qty')::numeric,
               (x->>'goods_value')::numeric, (x->>'allocated_extra')::numeric,
               (x->>'goods_value')::numeric + (x->>'allocated_extra')::numeric,
               CASE WHEN (x->>'qty')::numeric > 0
                 THEN ((x->>'goods_value')::numeric + (x->>'allocated_extra')::numeric) / (x->>'qty')::numeric
                 ELSE 0 END
        FROM ins
        CROSS JOIN payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        RETURNING id
      ),
      ${tag.unsafe(BALANCE_CTE)}
      SELECT CASE
        WHEN (SELECT count(*) FROM po_ok) = 0 THEN stock_fail('Pesanan beli belum posted atau sudah dibalik')
        WHEN (SELECT count(*) FROM bin_ok) = 0 THEN stock_fail('Penerimaan hanya boleh masuk bin gudang penerimaan')
        WHEN (SELECT count(*) FROM missing) > 0 THEN stock_fail('Ada barang yang tidak ada pada pesanan beli')
        WHEN (SELECT count(*) FROM over_qty) > 0 THEN stock_fail('Kuantitas melebihi sisa pesanan beli')
        WHEN (SELECT count(*) FROM line_ins) = 0 THEN stock_fail('Baris penerimaan kosong')
        ${guardBalance(tag)}
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postVendorBill(sql: SqlClient, actor: string, body: Body) {
  void actor;
  const doc = docNo(body.doc_no);
  const receiptId = idOf(body.receipt_id, "Penerimaan");
  const due = dateOf(body.due_date, "Jatuh tempo");
  const payload = { doc_no: doc, receipt_id: receiptId, due_date: due };
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      amt AS (
        SELECT COALESCE(SUM(grl.all_in_value), 0) AS amount
        FROM goods_receipt_lines grl, payload
        WHERE grl.receipt_id = (payload.p->>'receipt_id')::bigint
      ),
      ins AS (
        INSERT INTO vendor_bills (doc_no, receipt_id, vendor_id, amount, amount_open, due_date, status)
        SELECT payload.p->>'doc_no', gr.id, po.vendor_id, amt.amount, amt.amount,
               (payload.p->>'due_date')::date, 'open'
        FROM payload
        JOIN goods_receipts gr ON gr.id = (payload.p->>'receipt_id')::bigint AND gr.status = 'posted'
        JOIN purchase_orders po ON po.id = gr.order_id
        CROSS JOIN amt
        WHERE amt.amount > 0
          AND NOT EXISTS (SELECT 1 FROM vendor_bills vb WHERE vb.receipt_id = gr.id)
          AND NOT EXISTS (
            SELECT 1 FROM stock_reversals r
            WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id
          )
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM ins) = 0 THEN stock_fail('Tagihan hanya untuk penerimaan posted yang belum ditagih dan belum dibalik')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postVendorPayment(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  const billId = idOf(body.bill_id, "Tagihan");
  const fundId = idOf(body.fund_id, "Kas");
  const amount = moneyOf(body.amount, "Nilai bayar");
  if (!(amount > 0)) throw new StockPostError(400, "Nilai bayar harus lebih dari nol");
  const paidOn = dateOf(body.paid_on, "Tanggal bayar");
  const payload = { doc_no: doc, bill_id: billId, fund_id: fundId, amount, paid_on: paidOn };
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      bill_ok AS (
        SELECT vb.id
        FROM vendor_bills vb
        JOIN goods_receipts gr ON gr.id = vb.receipt_id
        , payload
        WHERE vb.id = (payload.p->>'bill_id')::bigint
          AND vb.status = 'open'
          AND vb.amount_open >= (payload.p->>'amount')::numeric
          AND gr.status = 'posted'
          AND NOT EXISTS (
            SELECT 1 FROM stock_reversals r
            WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id
          )
      ),
      fund_ok AS (
        SELECT cf.id FROM cash_funds cf, payload
        WHERE cf.id = (payload.p->>'fund_id')::bigint
          AND cf.balance >= (payload.p->>'amount')::numeric
      ),
      ins AS (
        INSERT INTO vendor_payments (doc_no, bill_id, amount, paid_on, fund_id, status, created_by)
        SELECT payload.p->>'doc_no', (payload.p->>'bill_id')::bigint, (payload.p->>'amount')::numeric,
               (payload.p->>'paid_on')::date, (payload.p->>'fund_id')::bigint, 'posted', ${actor}::bigint
        FROM payload
        WHERE (SELECT count(*) FROM bill_ok) = 1 AND (SELECT count(*) FROM fund_ok) = 1
        RETURNING id, amount, bill_id, fund_id
      ),
      bill_upd AS (
        UPDATE vendor_bills vb
        SET amount_open = vb.amount_open - ins.amount,
            status = CASE WHEN vb.amount_open - ins.amount = 0 THEN 'paid' ELSE 'open' END
        FROM ins
        WHERE vb.id = ins.bill_id AND vb.amount_open >= ins.amount
        RETURNING vb.id
      ),
      fund_upd AS (
        UPDATE cash_funds cf
        SET balance = cf.balance - ins.amount
        FROM ins
        WHERE cf.id = ins.fund_id AND cf.balance >= ins.amount
        RETURNING cf.id
      ),
      entry AS (
        INSERT INTO cash_fund_entries (fund_id, entry_kind, amount, memo, payment_id, created_by)
        SELECT ins.fund_id, 'spend', ins.amount, 'Pelunasan ' || (payload.p->>'doc_no'), ins.id, ${actor}::bigint
        FROM ins, payload
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM bill_ok) = 0 THEN stock_fail('Bayar hanya untuk tagihan terbuka yang penerimaannya sudah posted')
        WHEN (SELECT count(*) FROM fund_ok) = 0 THEN stock_fail('Saldo kas tidak mencukupi')
        WHEN (SELECT count(*) FROM bill_upd) = 0 OR (SELECT count(*) FROM fund_upd) = 0 OR (SELECT count(*) FROM entry) = 0
          THEN stock_fail('Pembayaran gagal karena saldo berubah. Muat ulang lalu coba lagi.')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postCashTopup(sql: SqlClient, actor: string, body: Body) {
  const fundId = idOf(body.fund_id, "Kas");
  const amount = moneyOf(body.amount, "Nilai");
  if (!(amount > 0)) throw new StockPostError(400, "Nilai uang muka harus lebih dari nol");
  const memo = String(body.memo ?? "").trim();
  if (!memo) throw new StockPostError(400, "Catatan uang muka wajib diisi");
  const payload = { fund_id: fundId, amount, memo };
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      fund_upd AS (
        UPDATE cash_funds
        SET balance = balance + (payload.p->>'amount')::numeric
        FROM payload
        WHERE cash_funds.id = (payload.p->>'fund_id')::bigint
        RETURNING cash_funds.id
      ),
      ins AS (
        INSERT INTO cash_fund_entries (fund_id, entry_kind, amount, memo, created_by)
        SELECT (payload.p->>'fund_id')::bigint, 'topup', (payload.p->>'amount')::numeric,
               payload.p->>'memo', ${actor}::bigint
        FROM payload
        WHERE (SELECT count(*) FROM fund_upd) = 1
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM ins) = 0 THEN stock_fail('Kas tidak ditemukan')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postProduction(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  const bomId = idOf(body.bom_id, "Resep");
  const outputQty = qtyOf(body.output_qty);
  const outputBin = idOf(body.output_bin_id, "Bin hasil");
  const sourceBin = idOf(body.source_bin_id, "Bin bahan");
  const { method, rollLabor } = await stockSettings(sql);
  const labor = rollLabor ? moneyOf(body.labor_cost ?? 0, "Biaya tenaga") : 0;
  const bom = (await sql`
    SELECT b.output_item_id, b.output_qty::numeric AS output_qty, bl.item_id, bl.qty::numeric AS qty
    FROM stock_boms b
    JOIN stock_bom_lines bl ON bl.bom_id = b.id
    WHERE b.id = ${bomId}
      AND b.effective_from <= ${todayJakarta()}::date
      AND (b.effective_to IS NULL OR b.effective_to > ${todayJakarta()}::date)
  `) as Array<{ output_item_id: string; output_qty: string; item_id: string; qty: string }>;
  if (bom.length === 0) throw new StockPostError(400, "Resep tidak ditemukan atau tidak berlaku");
  const outputItem = Number(bom[0].output_item_id);
  const factor = outputQty / asNumber(bom[0].output_qty);
  const needs = bom.map((line) => ({
    item_id: Number(line.item_id),
    qty: roundQty(asNumber(line.qty) * factor),
  }));
  const pairs = [
    ...needs.map((line) => ({ item_id: line.item_id, bin_id: sourceBin })),
    { item_id: outputItem, bin_id: outputBin },
  ];
  const held = await onHandMap(sql, pairs);
  let total = 0;
  const deltas: Array<ReturnType<typeof delta>> = [];
  for (const line of needs) {
    const row = hand(held, line.item_id, sourceBin);
    const value = await costOut(sql, method, line.item_id, sourceBin, line.qty, row);
    total = roundMoney(total + value);
    deltas.push(
      delta({
        itemId: line.item_id,
        binId: sourceBin,
        qtyDelta: -line.qty,
        valueDelta: -value,
        held: row,
        moveKind: "consume",
        moveQty: line.qty,
        moveValue: value,
      }),
    );
  }
  total = roundMoney(total + labor);
  const out = hand(held, outputItem, outputBin);
  deltas.push(
    delta({
      itemId: outputItem,
      binId: outputBin,
      qtyDelta: outputQty,
      valueDelta: total,
      held: out,
      moveKind: "produce",
      moveQty: outputQty,
      moveValue: total,
    }),
  );
  const payload = {
    doc_no: doc,
    bom_id: bomId,
    output_qty: outputQty,
    output_bin_id: outputBin,
    total_cost: total,
    lines: needs.map((line) => {
      const d = deltas.find((row) => row.item_id === line.item_id && row.move_kind === "consume");
      return { item_id: line.item_id, bin_id: sourceBin, qty: line.qty, value: d ? Math.abs(d.value_delta) : 0 };
    }),
    deltas,
    move_source: "production_order",
  };
  const tag = sql as SqlTag;
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      ins AS (
        INSERT INTO production_orders (doc_no, bom_id, output_qty, output_bin_id, status, total_cost, created_by, posted_at)
        SELECT payload.p->>'doc_no', (payload.p->>'bom_id')::bigint, (payload.p->>'output_qty')::numeric,
               (payload.p->>'output_bin_id')::bigint, 'posted', (payload.p->>'total_cost')::numeric,
               ${actor}::bigint, now()
        FROM payload
        RETURNING id
      ),
      line_ins AS (
        INSERT INTO production_lines (order_id, item_id, bin_id, qty, value)
        SELECT ins.id, (x->>'item_id')::bigint, (x->>'bin_id')::bigint, (x->>'qty')::numeric, (x->>'value')::numeric
        FROM ins
        CROSS JOIN payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        RETURNING id
      ),
      ${tag.unsafe(BALANCE_CTE)}
      SELECT CASE
        WHEN (SELECT count(*) FROM line_ins) = 0 THEN stock_fail('Resep tidak memiliki bahan')
        ${guardBalance(tag)}
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postShipment(sql: SqlClient, actor: string, body: Body) {
  void actor;
  const doc = docNo(body.doc_no);
  const orderId = idOf(body.order_id, "Order penjualan");
  const binId = idOf(body.bin_id, "Bin asal");
  const shippedOn = dateOf(body.shipped_on, "Tanggal kirim");
  const { method } = await stockSettings(sql);
  const grouped = new Map<number, number>();
  for (const line of rawLines(body)) {
    const itemId = idOf(line.item_id, "Barang");
    grouped.set(itemId, roundQty((grouped.get(itemId) ?? 0) + qtyOf(line.qty)));
  }
  const lines = [...grouped.entries()].map(([item_id, qty]) => ({ item_id, qty }));
  const orderLines = (await sql`
    SELECT sol.item_id, sol.qty::numeric AS qty
    FROM sales_order_lines sol
    JOIN sales_orders so ON so.id = sol.order_id
    WHERE so.id = ${orderId} AND so.status IN ('draft', 'posted')
      AND NOT EXISTS (
        SELECT 1 FROM stock_reversals r WHERE r.source_type = 'sales_order' AND r.source_id = so.id
      )
  `) as Array<{ item_id: string; qty: string }>;
  if (orderLines.length === 0) throw new StockPostError(400, "Order penjualan tidak ditemukan");
  const allowed = new Map(orderLines.map((line) => [Number(line.item_id), asNumber(line.qty)]));
  const shipped = (await sql`
    SELECT sl.item_id, COALESCE(SUM(sl.qty), 0)::numeric AS qty
    FROM shipment_lines sl
    JOIN shipments sh ON sh.id = sl.shipment_id
    WHERE sh.order_id = ${orderId} AND sh.status = 'posted'
      AND NOT EXISTS (
        SELECT 1 FROM stock_reversals r WHERE r.source_type = 'shipment' AND r.source_id = sh.id
      )
    GROUP BY sl.item_id
  `) as Array<{ item_id: string; qty: string }>;
  const sent = new Map(shipped.map((line) => [Number(line.item_id), asNumber(line.qty)]));
  const held = await onHandMap(sql, lines.map((line) => ({ item_id: line.item_id, bin_id: binId })));
  const priced = [];
  const deltas = [];
  for (const line of lines) {
    const cap = allowed.get(line.item_id);
    if (cap == null) throw new StockPostError(400, "Barang tidak ada pada order penjualan");
    const remain = roundQty(cap - (sent.get(line.item_id) ?? 0));
    if (line.qty > remain + 1e-9) throw new StockPostError(400, "Kuantitas kirim melebihi sisa order");
    const row = hand(held, line.item_id, binId);
    const value = await costOut(sql, method, line.item_id, binId, line.qty, row);
    const unit = line.qty > 0 ? roundQty(value / line.qty) : 0;
    priced.push({ item_id: line.item_id, qty: line.qty, unit_cost: unit, cogs_value: value });
    deltas.push(
      delta({
        itemId: line.item_id,
        binId,
        qtyDelta: -line.qty,
        valueDelta: -value,
        held: row,
        moveKind: "ship",
        moveQty: line.qty,
        moveValue: value,
      }),
    );
  }
  const payload = {
    doc_no: doc,
    order_id: orderId,
    bin_id: binId,
    shipped_on: shippedOn,
    lines: priced,
    deltas,
    move_source: "shipment",
  };
  const tag = sql as SqlTag;
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      ins AS (
        INSERT INTO shipments (doc_no, order_id, bin_id, status, shipped_on, posted_at)
        SELECT payload.p->>'doc_no', (payload.p->>'order_id')::bigint, (payload.p->>'bin_id')::bigint,
               'posted', (payload.p->>'shipped_on')::date, now()
        FROM payload
        RETURNING id, order_id
      ),
      line_ins AS (
        INSERT INTO shipment_lines (shipment_id, item_id, qty, unit_cost, cogs_value)
        SELECT ins.id, (x->>'item_id')::bigint, (x->>'qty')::numeric,
               (x->>'unit_cost')::numeric, (x->>'cogs_value')::numeric
        FROM ins
        CROSS JOIN payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        RETURNING id
      ),
      so_upd AS (
        UPDATE sales_orders so
        SET status = 'posted'
        FROM ins
        WHERE so.id = ins.order_id AND so.status = 'draft'
        RETURNING so.id
      ),
      ${tag.unsafe(BALANCE_CTE)}
      SELECT CASE
        WHEN (SELECT count(*) FROM line_ins) = 0 THEN stock_fail('Baris pengiriman kosong')
        WHEN (SELECT count(*) FROM so_upd) < 0 THEN stock_fail('Order tidak dapat diposting')
        ${guardBalance(tag)}
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postSalesInvoice(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  const shipmentId = idOf(body.shipment_id, "Pengiriman");
  const ship = (await sql`
    SELECT sh.shipped_on::text AS shipped_on, sp.party_kind, so.party_id
    FROM shipments sh
    JOIN sales_orders so ON so.id = sh.order_id
    JOIN stock_parties sp ON sp.id = so.party_id
    WHERE sh.id = ${shipmentId} AND sh.status = 'posted'
    LIMIT 1
  `) as Array<{ shipped_on: string; party_kind: string; party_id: string }>;
  if (!ship[0]) throw new StockPostError(400, "Pengiriman posted tidak ditemukan");
  const fallback = await marginFor(sql, ship[0].party_kind, ship[0].shipped_on.slice(0, 10));
  const payload = { doc_no: doc, shipment_id: shipmentId, fallback_margin: fallback };
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      src AS (
        SELECT sh.id AS shipment_id, so.party_id, sp.party_kind, sh.shipped_on
        FROM payload
        JOIN shipments sh ON sh.id = (payload.p->>'shipment_id')::bigint AND sh.status = 'posted'
        JOIN sales_orders so ON so.id = sh.order_id
        JOIN stock_parties sp ON sp.id = so.party_id
        WHERE NOT EXISTS (SELECT 1 FROM sales_invoices si WHERE si.shipment_id = sh.id)
          AND NOT EXISTS (
            SELECT 1 FROM stock_reversals r WHERE r.source_type = 'shipment' AND r.source_id = sh.id
          )
      ),
      margin AS (
        SELECT COALESCE(
          (
            SELECT pl.margin_percent
            FROM stock_price_lists pl, src
            WHERE pl.party_kind = src.party_kind
              AND pl.effective_from <= src.shipped_on
              AND (pl.effective_to IS NULL OR pl.effective_to > src.shipped_on)
            ORDER BY pl.effective_from DESC
            LIMIT 1
          ),
          (SELECT (p->>'fallback_margin')::numeric FROM payload p)
        ) AS pct
      ),
      priced AS (
        SELECT sl.item_id, sl.qty, sl.unit_cost, sl.cogs_value,
               sl.unit_cost * (1 + margin.pct / 100) AS unit_price,
               round(sl.qty * sl.unit_cost * (1 + margin.pct / 100), 2) AS line_amount
        FROM shipment_lines sl
        JOIN src ON src.shipment_id = sl.shipment_id
        CROSS JOIN margin
      ),
      ins AS (
        INSERT INTO sales_invoices (doc_no, shipment_id, party_id, amount, cogs_amount, status, created_by)
        SELECT (SELECT p->>'doc_no' FROM payload p), src.shipment_id, src.party_id,
               COALESCE((SELECT SUM(line_amount) FROM priced), 0),
               COALESCE((SELECT SUM(cogs_value) FROM priced), 0),
               'posted', ${actor}::bigint
        FROM src
        WHERE (SELECT count(*) FROM priced) > 0
        RETURNING id
      ),
      line_ins AS (
        INSERT INTO sales_invoice_lines (invoice_id, item_id, qty, unit_cost, unit_price, line_amount, cogs_value)
        SELECT ins.id, priced.item_id, priced.qty, priced.unit_cost, priced.unit_price, priced.line_amount, priced.cogs_value
        FROM ins, priced
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM line_ins) = 0 THEN stock_fail('Faktur hanya untuk pengiriman posted yang belum difakturkan')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

export async function postStockCount(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  const binId = idOf(body.bin_id, "Bin");
  const countedOn = dateOf(body.counted_on, "Tanggal hitung");
  const lines = rawLines(body).map((line) => ({
    item_id: idOf(line.item_id, "Barang"),
    qty_count: roundQty(Number(line.qty_count)),
    unit_cost: line.unit_cost == null || line.unit_cost === "" ? null : moneyOf(line.unit_cost, "Biaya satuan"),
  }));
  if (lines.some((line) => line.qty_count < 0)) throw new StockPostError(400, "Hasil hitung tidak boleh negatif");
  const held = await onHandMap(sql, lines.map((line) => ({ item_id: line.item_id, bin_id: binId })));
  const countLines = [];
  const deltas = [];
  for (const line of lines) {
    const row = hand(held, line.item_id, binId);
    const system = roundQty(asNumber(row.qty));
    const variance = roundQty(line.qty_count - system);
    countLines.push({
      item_id: line.item_id,
      qty_system: system,
      qty_count: line.qty_count,
      variance,
    });
    if (Math.abs(variance) < 1e-9) continue;
    let valueDelta = 0;
    if (variance < 0) {
      valueDelta = -movingAverageIssueValue(system, asNumber(row.value), -variance);
    } else if (system <= 1e-9) {
      if (line.unit_cost == null) {
        throw new StockPostError(400, "Biaya satuan wajib diisi saat barang belum punya saldo");
      }
      valueDelta = roundMoney(variance * line.unit_cost);
    } else {
      const unit = system > 0 ? asNumber(row.value) / system : 0;
      valueDelta = roundMoney(variance * unit);
    }
    deltas.push(
      delta({
        itemId: line.item_id,
        binId,
        qtyDelta: variance,
        valueDelta,
        held: row,
        moveKind: "count",
        moveQty: variance,
        moveValue: valueDelta,
      }),
    );
  }
  const payload = {
    doc_no: doc,
    bin_id: binId,
    counted_on: countedOn,
    lines: countLines,
    deltas,
    move_source: "stock_count",
  };
  const tag = sql as SqlTag;
  const balanceGuard =
    deltas.length === 0
      ? tag.unsafe(`WHEN FALSE THEN stock_fail('skip')`)
      : guardBalance(tag);
  const balanceCte = deltas.length === 0 ? tag.unsafe(`dlt AS (SELECT 1 WHERE FALSE), moves AS (SELECT 1 WHERE FALSE), upd AS (SELECT 1 WHERE FALSE), insb AS (SELECT 1 WHERE FALSE)`) : tag.unsafe(BALANCE_CTE);
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      bin_ok AS (
        SELECT id FROM stock_bins b, payload
        WHERE b.id = (payload.p->>'bin_id')::bigint AND b.deleted_at IS NULL
      ),
      ins AS (
        INSERT INTO stock_counts (doc_no, bin_id, status, counted_on, created_by)
        SELECT payload.p->>'doc_no', (payload.p->>'bin_id')::bigint, 'posted',
               (payload.p->>'counted_on')::date, ${actor}::bigint
        FROM payload
        WHERE (SELECT count(*) FROM bin_ok) = 1
        RETURNING id
      ),
      line_ins AS (
        INSERT INTO stock_count_lines (count_id, item_id, qty_system, qty_count, variance)
        SELECT ins.id, (x->>'item_id')::bigint, (x->>'qty_system')::numeric,
               (x->>'qty_count')::numeric, (x->>'variance')::numeric
        FROM ins
        CROSS JOIN payload
        CROSS JOIN LATERAL jsonb_array_elements(payload.p->'lines') x
        RETURNING id
      ),
      ${balanceCte}
      SELECT CASE
        WHEN (SELECT count(*) FROM bin_ok) = 0 THEN stock_fail('Bin tidak ditemukan')
        WHEN (SELECT count(*) FROM line_ins) = 0 THEN stock_fail('Baris opname kosong')
        ${balanceGuard}
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

const REVERSAL_TYPES = new Set([
  "purchase_order",
  "goods_receipt",
  "production_order",
  "shipment",
  "sales_invoice",
  "vendor_payment",
  "stock_count",
]);

export async function postReversal(sql: SqlClient, actor: string, body: Body) {
  const doc = docNo(body.doc_no);
  let sourceType = String(body.source_type ?? "");
  let sourceId = 0;
  if (!sourceType && typeof body.source === "string" && body.source.includes(":")) {
    const [kind, rawId] = String(body.source).split(":");
    sourceType = kind;
    sourceId = idOf(rawId, "Dokumen asal");
  } else {
    sourceId = idOf(body.source_id, "Dokumen asal");
  }
  const reason = String(body.reason ?? "").trim();
  if (!REVERSAL_TYPES.has(sourceType)) throw new StockPostError(400, "Jenis dokumen pembalik tidak dikenal");
  if (!reason) throw new StockPostError(400, "Alasan pembalik wajib diisi");
  const dup = await sql`
    SELECT 1 FROM stock_reversals WHERE source_type = ${sourceType} AND source_id = ${sourceId} LIMIT 1
  `;
  if (dup[0]) throw new StockPostError(400, "Dokumen ini sudah dibalik");

  if (sourceType === "purchase_order") {
    const blocked = await sql`
      SELECT 1 FROM goods_receipts gr
      WHERE gr.order_id = ${sourceId} AND gr.status = 'posted'
        AND NOT EXISTS (
          SELECT 1 FROM stock_reversals r WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id
        )
      LIMIT 1
    `;
    if (blocked[0]) throw new StockPostError(400, "Balik penerimaan yang masih posted sebelum membalik pesanan beli");
    return insertReversal(sql, actor, doc, sourceType, sourceId, reason);
  }

  if (sourceType === "sales_invoice") {
    return insertReversal(sql, actor, doc, sourceType, sourceId, reason);
  }

  if (sourceType === "vendor_payment") {
    return reversePayment(sql, actor, doc, sourceId, reason);
  }

  const moves = (await sql`
    SELECT item_id, bin_id, move_kind, qty::text AS qty, value::text AS value
    FROM stock_moves
    WHERE source_type = ${sourceType} AND source_id = ${sourceId}
    ORDER BY id
  `) as Array<{ item_id: string; bin_id: string; move_kind: string; qty: string; value: string }>;
  if (moves.length === 0) throw new StockPostError(400, "Dokumen asal tidak memiliki mutasi yang bisa dibalik");

  if (sourceType === "goods_receipt") {
    const paid = await sql`
      SELECT 1
      FROM vendor_bills vb
      JOIN vendor_payments vp ON vp.bill_id = vb.id AND vp.status = 'posted'
      WHERE vb.receipt_id = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM stock_reversals r WHERE r.source_type = 'vendor_payment' AND r.source_id = vp.id
        )
      LIMIT 1
    `;
    if (paid[0]) throw new StockPostError(400, "Balik pembayaran vendor sebelum membalik penerimaan");
  }
  if (sourceType === "shipment") {
    const invoiced = await sql`
      SELECT 1 FROM sales_invoices si
      WHERE si.shipment_id = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM stock_reversals r WHERE r.source_type = 'sales_invoice' AND r.source_id = si.id
        )
      LIMIT 1
    `;
    if (invoiced[0]) throw new StockPostError(400, "Balik faktur sebelum membalik pengiriman");
  }

  const pairs = moves.map((move) => ({ item_id: Number(move.item_id), bin_id: Number(move.bin_id) }));
  const held = await onHandMap(sql, pairs);
  const deltas = moves.map((move) => {
    const itemId = Number(move.item_id);
    const binId = Number(move.bin_id);
    const qty = asNumber(move.qty);
    const value = asNumber(move.value);
    const inbound = move.move_kind === "receipt" || move.move_kind === "produce" || (move.move_kind === "count" && qty > 0);
    const qtyDelta = inbound ? -Math.abs(qty) : Math.abs(qty);
    const valueDelta = inbound ? -Math.abs(value) : Math.abs(value);
    const row = hand(held, itemId, binId);
    if (qtyDelta < 0 && asNumber(row.qty) + qtyDelta < -1e-9) {
      throw new StockPostError(400, "Stok tersisa tidak cukup untuk membalik dokumen ini. Balik dokumen turunannya dulu.");
    }
    return delta({
      itemId,
      binId,
      qtyDelta,
      valueDelta,
      held: row,
      moveKind: "reversal",
      moveQty: qtyDelta,
      moveValue: valueDelta,
    });
  });

  const payload = {
    doc_no: doc,
    source_type: sourceType,
    source_id: sourceId,
    reason,
    deltas,
    move_source: "stock_reversal",
    receipt_id: sourceType === "goods_receipt" ? sourceId : null,
  };
  const tag = sql as SqlTag;
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      ins AS (
        INSERT INTO stock_reversals (doc_no, source_type, source_id, reason, created_by, posted_at)
        SELECT payload.p->>'doc_no', payload.p->>'source_type', (payload.p->>'source_id')::bigint,
               payload.p->>'reason', ${actor}::bigint, now()
        FROM payload
        WHERE NOT EXISTS (
          SELECT 1 FROM stock_reversals r
          WHERE r.source_type = payload.p->>'source_type'
            AND r.source_id = (payload.p->>'source_id')::bigint
        )
        RETURNING id
      ),
      bill_upd AS (
        UPDATE vendor_bills vb
        SET amount_open = 0, status = 'reversed'
        FROM payload
        WHERE payload.p->>'source_type' = 'goods_receipt'
          AND vb.receipt_id = (payload.p->>'source_id')::bigint
          AND vb.amount_open = vb.amount
          AND (SELECT count(*) FROM ins) = 1
        RETURNING vb.id
      ),
      ${tag.unsafe(BALANCE_CTE)}
      SELECT CASE
        WHEN (SELECT count(*) FROM ins) = 0 THEN stock_fail('Dokumen sudah dibalik')
        ${guardBalance(tag)}
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

async function insertReversal(sql: SqlClient, actor: string, doc: string, sourceType: string, sourceId: number, reason: string) {
  return execute(
    sql,
    sql`
      WITH ins AS (
        INSERT INTO stock_reversals (doc_no, source_type, source_id, reason, created_by)
        SELECT ${doc}, ${sourceType}, ${sourceId}, ${reason}, ${actor}::bigint
        WHERE NOT EXISTS (
          SELECT 1 FROM stock_reversals r WHERE r.source_type = ${sourceType} AND r.source_id = ${sourceId}
        )
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM ins) = 0 THEN stock_fail('Dokumen sudah dibalik')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

async function reversePayment(sql: SqlClient, actor: string, doc: string, paymentId: number, reason: string) {
  const payload = { doc_no: doc, source_id: paymentId, reason };
  return execute(
    sql,
    sql`
      WITH payload AS (SELECT ${JSON.stringify(payload)}::jsonb AS p),
      pay AS (
        SELECT vp.id, vp.bill_id, vp.fund_id, vp.amount
        FROM vendor_payments vp, payload
        WHERE vp.id = (payload.p->>'source_id')::bigint AND vp.status = 'posted' AND vp.fund_id IS NOT NULL
      ),
      ins AS (
        INSERT INTO stock_reversals (doc_no, source_type, source_id, reason, created_by)
        SELECT payload.p->>'doc_no', 'vendor_payment', pay.id, payload.p->>'reason', ${actor}::bigint
        FROM pay, payload
        WHERE NOT EXISTS (
          SELECT 1 FROM stock_reversals r WHERE r.source_type = 'vendor_payment' AND r.source_id = pay.id
        )
        RETURNING id
      ),
      bill_upd AS (
        UPDATE vendor_bills vb
        SET amount_open = vb.amount_open + pay.amount, status = 'open'
        FROM pay, ins
        WHERE vb.id = pay.bill_id AND vb.amount_open + pay.amount <= vb.amount
        RETURNING vb.id
      ),
      fund_upd AS (
        UPDATE cash_funds cf
        SET balance = cf.balance + pay.amount
        FROM pay, ins
        WHERE cf.id = pay.fund_id
        RETURNING cf.id
      ),
      entry AS (
        INSERT INTO cash_fund_entries (fund_id, entry_kind, amount, memo, payment_id, created_by)
        SELECT pay.fund_id, 'topup', pay.amount, 'Pembalik ' || (SELECT p->>'doc_no' FROM payload p), pay.id, ${actor}::bigint
        FROM pay, ins
        RETURNING id
      )
      SELECT CASE
        WHEN (SELECT count(*) FROM pay) = 0 THEN stock_fail('Pembayaran posted tidak ditemukan')
        WHEN (SELECT count(*) FROM ins) = 0 THEN stock_fail('Pembayaran sudah dibalik')
        WHEN (SELECT count(*) FROM bill_upd) = 0 OR (SELECT count(*) FROM fund_upd) = 0
          THEN stock_fail('Hutang tidak dapat dikembalikan')
        ELSE (SELECT id::text FROM ins)
      END AS id
    `,
  );
}

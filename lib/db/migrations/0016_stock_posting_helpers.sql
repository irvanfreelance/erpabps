-- Pembantu posting stok. CREATE OR REPLACE aman dijalankan ulang.
-- Angka dokumen CONTOH tidak diubah. Hanya cap waktu ledger CONTOH
-- disejajarkan ke tanggal bisnis 9 Nov 2026 agar filter periode konsisten.

CREATE OR REPLACE FUNCTION stock_fail(msg text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '%', msg USING ERRCODE = 'P0001';
END;
$$;

UPDATE purchase_requests
SET posted_at = TIMESTAMPTZ '2026-11-09 07:30:00+07'
WHERE doc_no = 'PR-CONTOH';

UPDATE purchase_orders
SET posted_at = TIMESTAMPTZ '2026-11-09 07:40:00+07'
WHERE doc_no = 'PO-CONTOH';

UPDATE goods_receipts
SET posted_at = TIMESTAMPTZ '2026-11-09 08:10:00+07'
WHERE doc_no = 'GRN-CONTOH';

UPDATE production_orders
SET posted_at = TIMESTAMPTZ '2026-11-09 09:00:00+07'
WHERE doc_no = 'MO-CONTOH';

UPDATE shipments
SET posted_at = TIMESTAMPTZ '2026-11-09 10:00:00+07'
WHERE doc_no = 'DO-OUT';

UPDATE shipments
SET posted_at = TIMESTAMPTZ '2026-11-09 10:30:00+07'
WHERE doc_no = 'DO-CAT';

UPDATE stock_moves sm
SET created_at = TIMESTAMPTZ '2026-11-09 08:10:00+07'
FROM goods_receipts gr
WHERE sm.source_type = 'goods_receipt'
  AND sm.source_id = gr.id
  AND gr.doc_no = 'GRN-CONTOH';

UPDATE stock_moves sm
SET created_at = TIMESTAMPTZ '2026-11-09 09:00:00+07'
FROM production_orders mo
WHERE sm.source_type = 'production_order'
  AND sm.source_id = mo.id
  AND mo.doc_no = 'MO-CONTOH';

UPDATE stock_moves sm
SET created_at = TIMESTAMPTZ '2026-11-09 10:00:00+07'
FROM shipments sh
WHERE sm.source_type = 'shipment'
  AND sm.source_id = sh.id
  AND sh.doc_no = 'DO-OUT';

UPDATE stock_moves sm
SET created_at = TIMESTAMPTZ '2026-11-09 10:30:00+07'
FROM shipments sh
WHERE sm.source_type = 'shipment'
  AND sm.source_id = sh.id
  AND sh.doc_no = 'DO-CAT';

UPDATE cash_fund_entries e
SET created_at = TIMESTAMPTZ '2026-11-09 07:00:00+07'
FROM cash_funds f
WHERE e.fund_id = f.id
  AND f.code = 'KAS_DAPUR'
  AND e.entry_kind = 'topup'
  AND e.amount = 2000000
  AND e.memo = 'Uang muka operasional dapur harian';

UPDATE cash_fund_entries e
SET created_at = TIMESTAMPTZ '2026-11-09 11:00:00+07'
FROM vendor_payments p
WHERE e.payment_id = p.id
  AND p.doc_no = 'PAY-CONTOH';

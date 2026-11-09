-- 0014_stock_and_cogs_module.sql
-- Modul Stok dan HPP — ERP Ayam Bakar Pucuk Singkong
-- Berdasarkan spesifikasi refs / stock.md bagian 9

-- 1. Master Stok
CREATE TABLE IF NOT EXISTS stock_uoms (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_item_categories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_items (
    id              BIGSERIAL PRIMARY KEY,
    sku             VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    category_id     BIGINT       NOT NULL REFERENCES stock_item_categories(id),
    uom_id          BIGINT       NOT NULL REFERENCES stock_uoms(id),
    item_kind       VARCHAR(30)  NOT NULL,
      -- material | semi_finished | finished
    is_stocked      BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stock_items_kind ON stock_items(item_kind) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS stock_bins (
    id           BIGSERIAL PRIMARY KEY,
    code         VARCHAR(50)  NOT NULL UNIQUE,
    name         VARCHAR(200) NOT NULL,
    bin_kind     VARCHAR(30)  NOT NULL,
      -- receiving | storage | production
    location_id  BIGINT       REFERENCES locations(id),
    is_receiving BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMPTZ,
    CONSTRAINT ck_one_receiving CHECK (
        is_receiving = FALSE OR bin_kind = 'receiving'
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_one_receiving
    ON stock_bins(is_receiving) WHERE is_receiving = TRUE AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS stock_parties (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(50)  NOT NULL UNIQUE,
    name          VARCHAR(200) NOT NULL,
    party_kind    VARCHAR(30)  NOT NULL,
      -- vendor | internal_outlet | third_party_outlet | catering
    location_id   BIGINT       REFERENCES locations(id),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_boms (
    id               BIGSERIAL PRIMARY KEY,
    output_item_id   BIGINT        NOT NULL REFERENCES stock_items(id),
    output_qty       NUMERIC(18,6) NOT NULL CHECK (output_qty > 0),
    effective_from   DATE          NOT NULL,
    effective_to     DATE,
    CONSTRAINT ck_bom_range CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS stock_bom_lines (
    id          BIGSERIAL PRIMARY KEY,
    bom_id      BIGINT        NOT NULL REFERENCES stock_boms(id),
    item_id     BIGINT        NOT NULL REFERENCES stock_items(id),
    qty         NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    CONSTRAINT uq_bom_item UNIQUE (bom_id, item_id)
);

CREATE TABLE IF NOT EXISTS stock_price_lists (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    party_kind      VARCHAR(30) NOT NULL,
    margin_percent  NUMERIC(8,4) NOT NULL,
    effective_from  DATE        NOT NULL,
    effective_to    DATE
);

-- 2. Pembelian, Kas, Hutang
CREATE TABLE IF NOT EXISTS purchase_requests (
    id            BIGSERIAL PRIMARY KEY,
    doc_no        VARCHAR(40) NOT NULL UNIQUE,
    source_unit   VARCHAR(30) NOT NULL,
      -- dapur | outlet
    status        VARCHAR(20) NOT NULL,
      -- draft | posted
    needed_on     DATE        NOT NULL,
    created_by    BIGINT      NOT NULL REFERENCES users(id),
    posted_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_request_lines (
    id          BIGSERIAL PRIMARY KEY,
    request_id  BIGINT        NOT NULL REFERENCES purchase_requests(id),
    item_id     BIGINT        NOT NULL REFERENCES stock_items(id),
    qty         NUMERIC(18,6) NOT NULL CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id           BIGSERIAL PRIMARY KEY,
    doc_no       VARCHAR(40) NOT NULL UNIQUE,
    request_id   BIGINT      REFERENCES purchase_requests(id),
    vendor_id    BIGINT      NOT NULL REFERENCES stock_parties(id),
    status       VARCHAR(20) NOT NULL,
    source_unit  VARCHAR(30) NOT NULL DEFAULT 'purchasing',
    created_by   BIGINT      NOT NULL REFERENCES users(id),
    posted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT        NOT NULL REFERENCES purchase_orders(id),
    item_id     BIGINT        NOT NULL REFERENCES stock_items(id),
    qty         NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    price_hint  NUMERIC(18,2)
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id            BIGSERIAL PRIMARY KEY,
    doc_no        VARCHAR(40) NOT NULL UNIQUE,
    order_id      BIGINT      NOT NULL REFERENCES purchase_orders(id),
    bin_id        BIGINT      NOT NULL REFERENCES stock_bins(id),
    status        VARCHAR(20) NOT NULL,
    hpp_method    VARCHAR(30) NOT NULL,
    freight_cost  NUMERIC(18,2) NOT NULL DEFAULT 0,
    other_cost    NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_by    BIGINT      NOT NULL REFERENCES users(id),
    posted_at     TIMESTAMPTZ,
    CONSTRAINT ck_grn_receiving CHECK (status <> 'posted' OR posted_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
    id              BIGSERIAL PRIMARY KEY,
    receipt_id      BIGINT        NOT NULL REFERENCES goods_receipts(id),
    item_id         BIGINT        NOT NULL REFERENCES stock_items(id),
    qty             NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    goods_value     NUMERIC(18,2) NOT NULL,
    allocated_extra NUMERIC(18,2) NOT NULL DEFAULT 0,
    all_in_value    NUMERIC(18,2) NOT NULL,
    unit_cost       NUMERIC(18,6) NOT NULL,
    CONSTRAINT ck_all_in CHECK (all_in_value = goods_value + allocated_extra)
);

CREATE TABLE IF NOT EXISTS vendor_bills (
    id           BIGSERIAL PRIMARY KEY,
    doc_no       VARCHAR(40) NOT NULL UNIQUE,
    receipt_id   BIGINT      NOT NULL UNIQUE REFERENCES goods_receipts(id),
    vendor_id    BIGINT      NOT NULL REFERENCES stock_parties(id),
    amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    amount_open  NUMERIC(18,2) NOT NULL,
    due_date     DATE        NOT NULL,
    status       VARCHAR(20) NOT NULL,
      -- open | paid
    CONSTRAINT ck_bill_open CHECK (amount_open >= 0 AND amount_open <= amount)
);

CREATE TABLE IF NOT EXISTS cash_funds (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    balance     NUMERIC(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT ck_fund_nonneg CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS vendor_payments (
    id          BIGSERIAL PRIMARY KEY,
    doc_no      VARCHAR(40) NOT NULL UNIQUE,
    bill_id     BIGINT      NOT NULL REFERENCES vendor_bills(id),
    amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    paid_on     DATE        NOT NULL,
    fund_id     BIGINT      REFERENCES cash_funds(id),
    status      VARCHAR(20) NOT NULL,
    created_by  BIGINT      NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cash_fund_entries (
    id          BIGSERIAL PRIMARY KEY,
    fund_id     BIGINT      NOT NULL REFERENCES cash_funds(id),
    entry_kind  VARCHAR(20) NOT NULL,
      -- topup | spend
    amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    memo        TEXT        NOT NULL,
    payment_id  BIGINT      REFERENCES vendor_payments(id),
    created_by  BIGINT      NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Gerakan Stok, Saldo, Produksi, Jual, Opname, Pembalik
CREATE TABLE IF NOT EXISTS stock_balances (
    id          BIGSERIAL PRIMARY KEY,
    item_id     BIGINT        NOT NULL REFERENCES stock_items(id),
    bin_id      BIGINT        NOT NULL REFERENCES stock_bins(id),
    qty         NUMERIC(18,6) NOT NULL,
    value       NUMERIC(18,2) NOT NULL,
    unit_cost   NUMERIC(18,6) NOT NULL,
    CONSTRAINT uq_balance UNIQUE (item_id, bin_id),
    CONSTRAINT ck_balance_nonneg CHECK (qty >= 0 AND value >= 0)
);

CREATE TABLE IF NOT EXISTS stock_moves (
    id            BIGSERIAL PRIMARY KEY,
    item_id       BIGINT        NOT NULL REFERENCES stock_items(id),
    bin_id        BIGINT        NOT NULL REFERENCES stock_bins(id),
    move_kind     VARCHAR(30)   NOT NULL,
      -- receipt | consume | produce | ship | count | reversal
    qty           NUMERIC(18,6) NOT NULL,
    value         NUMERIC(18,2) NOT NULL,
    unit_cost     NUMERIC(18,6) NOT NULL,
    source_type   VARCHAR(40)   NOT NULL,
    source_id     BIGINT        NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_moves_item ON stock_moves(item_id, bin_id, created_at);

CREATE TABLE IF NOT EXISTS production_orders (
    id            BIGSERIAL PRIMARY KEY,
    doc_no        VARCHAR(40) NOT NULL UNIQUE,
    bom_id        BIGINT      NOT NULL REFERENCES stock_boms(id),
    output_qty    NUMERIC(18,6) NOT NULL CHECK (output_qty > 0),
    output_bin_id BIGINT      NOT NULL REFERENCES stock_bins(id),
    status        VARCHAR(20) NOT NULL,
    total_cost    NUMERIC(18,2),
    created_by    BIGINT      NOT NULL REFERENCES users(id),
    posted_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS production_lines (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT        NOT NULL REFERENCES production_orders(id),
    item_id       BIGINT        NOT NULL REFERENCES stock_items(id),
    bin_id        BIGINT        NOT NULL REFERENCES stock_bins(id),
    qty           NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    value         NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_orders (
    id           BIGSERIAL PRIMARY KEY,
    doc_no       VARCHAR(40) NOT NULL UNIQUE,
    party_id     BIGINT      NOT NULL REFERENCES stock_parties(id),
    status       VARCHAR(20) NOT NULL,
    ordered_on   DATE        NOT NULL,
    created_by   BIGINT      NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
    id        BIGSERIAL PRIMARY KEY,
    order_id  BIGINT        NOT NULL REFERENCES sales_orders(id),
    item_id   BIGINT        NOT NULL REFERENCES stock_items(id),
    qty       NUMERIC(18,6) NOT NULL CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS shipments (
    id          BIGSERIAL PRIMARY KEY,
    doc_no      VARCHAR(40) NOT NULL UNIQUE,
    order_id    BIGINT      NOT NULL REFERENCES sales_orders(id),
    bin_id      BIGINT      NOT NULL REFERENCES stock_bins(id),
    status      VARCHAR(20) NOT NULL,
    shipped_on  DATE        NOT NULL,
    posted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS shipment_lines (
    id           BIGSERIAL PRIMARY KEY,
    shipment_id  BIGINT        NOT NULL REFERENCES shipments(id),
    item_id      BIGINT        NOT NULL REFERENCES stock_items(id),
    qty          NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    unit_cost    NUMERIC(18,6) NOT NULL,
    cogs_value   NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_invoices (
    id           BIGSERIAL PRIMARY KEY,
    doc_no       VARCHAR(40) NOT NULL UNIQUE,
    shipment_id  BIGINT      NOT NULL UNIQUE REFERENCES shipments(id),
    party_id     BIGINT      NOT NULL REFERENCES stock_parties(id),
    amount       NUMERIC(18,2) NOT NULL,
    cogs_amount  NUMERIC(18,2) NOT NULL,
    status       VARCHAR(20) NOT NULL,
    created_by   BIGINT      NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
    id           BIGSERIAL PRIMARY KEY,
    invoice_id   BIGINT        NOT NULL REFERENCES sales_invoices(id),
    item_id      BIGINT        NOT NULL REFERENCES stock_items(id),
    qty          NUMERIC(18,6) NOT NULL,
    unit_cost    NUMERIC(18,6) NOT NULL,
    unit_price   NUMERIC(18,6) NOT NULL,
    line_amount  NUMERIC(18,2) NOT NULL,
    cogs_value   NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_counts (
    id          BIGSERIAL PRIMARY KEY,
    doc_no      VARCHAR(40) NOT NULL UNIQUE,
    bin_id      BIGINT      NOT NULL REFERENCES stock_bins(id),
    status      VARCHAR(20) NOT NULL,
    counted_on  DATE        NOT NULL,
    created_by  BIGINT      NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
    id          BIGSERIAL PRIMARY KEY,
    count_id    BIGINT        NOT NULL REFERENCES stock_counts(id),
    item_id     BIGINT        NOT NULL REFERENCES stock_items(id),
    qty_system  NUMERIC(18,6) NOT NULL,
    qty_count   NUMERIC(18,6) NOT NULL,
    variance    NUMERIC(18,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_reversals (
    id            BIGSERIAL PRIMARY KEY,
    doc_no        VARCHAR(40) NOT NULL UNIQUE,
    source_type   VARCHAR(40) NOT NULL,
    source_id     BIGINT      NOT NULL,
    reason        TEXT        NOT NULL,
    created_by    BIGINT      NOT NULL REFERENCES users(id),
    posted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Definisi dan Nilai Default Setting Modul Stok
INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
VALUES
  ('stock.hpp_method', 'stock', 'Metode Perhitungan HPP', 'string', '{"v":"moving_average"}', '{org}', FALSE),
  ('stock.freight_allocation', 'stock', 'Alokasi Ongkir dan Biaya Lain', 'string', '{"v":"by_value"}', '{org}', FALSE),
  ('stock.allow_negative', 'stock', 'Izinkan Stok Negatif', 'boolean', '{"v":false}', '{org}', FALSE),
  ('stock.roll_labor_into_hpp', 'stock', 'Gulung Biaya Tenaga ke HPP Produksi', 'boolean', '{"v":false}', '{org}', FALSE),
  ('stock.margin.internal_outlet', 'stock', 'Margin Penjualan Outlet Internal (%)', 'decimal', '{"v":20}', '{org}', FALSE),
  ('stock.margin.third_party_outlet', 'stock', 'Margin Penjualan Outlet Mitra (%)', 'decimal', '{"v":20}', '{org}', FALSE),
  ('stock.margin.catering', 'stock', 'Margin Penjualan Katering (%)', 'decimal', '{"v":30}', '{org}', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO setting_values (
  definition_id, scope_type, scope_id, value, effective_from, status, source_ref, reason, created_by
)
SELECT d.id, 'org', NULL, d.default_value::jsonb, DATE '2026-11-01', 'active', 'stock.md', 'Inisialisasi setting modul stok', 1
FROM setting_definitions d
WHERE d.category = 'stock'
  AND NOT EXISTS (
    SELECT 1 FROM setting_values v WHERE v.definition_id = d.id AND v.scope_type = 'org' AND v.status = 'active'
  );


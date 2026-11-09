-- 0015_seed_stock_cycle.sql
-- Seed satu siklus lengkap modul stok & HPP
-- Mengikuti stock.md bagian 10:
-- Belanja Rp672.000 (Barang 640.000 + Ongkir 32.000)
-- Kas Dapur Rp2.000.000 topup, bayar Rp672.000 -> sisa Rp1.328.000
-- Produksi 10 kg Ayam Ungkep HPP Rp38.640/kg
-- Penjualan Outlet 4 kg (Omzet 185.472, HPP 154.560, Laba 30.912)
-- Penjualan Catering 3 kg (Omzet 150.696, HPP 115.920, Laba 34.776)
-- Sisa persediaan: Rp401.520. Persediaan + HPP keluar = Rp672.000.

DO $$
DECLARE
    v_admin_id BIGINT;
    v_uom_kg_id BIGINT;
    v_cat_bahan_id BIGINT;
    v_cat_olahan_id BIGINT;
    v_item_ayam_id BIGINT;
    v_item_bumbu_id BIGINT;
    v_item_ungkep_id BIGINT;
    v_bin_gudang_id BIGINT;
    v_bin_freezer_id BIGINT;
    v_party_vendor_id BIGINT;
    v_party_outlet_int_id BIGINT;
    v_party_outlet_mitra_id BIGINT;
    v_party_catering_id BIGINT;
    v_loc_dapur_id BIGINT;
    v_loc_baros_id BIGINT;
    v_bom_id BIGINT;
    v_fund_id BIGINT;
    v_pr_id BIGINT;
    v_po_id BIGINT;
    v_grn_id BIGINT;
    v_bill_id BIGINT;
    v_payment_id BIGINT;
    v_mo_id BIGINT;
    v_so_out_id BIGINT;
    v_ship_out_id BIGINT;
    v_inv_out_id BIGINT;
    v_so_cat_id BIGINT;
    v_ship_cat_id BIGINT;
    v_inv_cat_id BIGINT;
BEGIN
    -- Superadmin user untuk created_by
    SELECT id INTO v_admin_id FROM users WHERE role = 'superadmin' ORDER BY id ASC LIMIT 1;
    IF v_admin_id IS NULL THEN
        v_admin_id := 1;
    END IF;

    -- Lokasi dapur dan outlet jika ada
    SELECT id INTO v_loc_dapur_id FROM locations WHERE code = 'DAPUR_PUSAT' OR code = 'DAPUR' LIMIT 1;
    SELECT id INTO v_loc_baros_id FROM locations WHERE code = 'OUTLET_BAROS' OR code = 'BAROS' LIMIT 1;

    -- 1. Master Satuan
    INSERT INTO stock_uoms (code, name)
    VALUES ('KG', 'Kilogram')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_uom_kg_id;

    -- 2. Master Kategori
    INSERT INTO stock_item_categories (code, name)
    VALUES 
        ('BAHAN', 'Bahan Baku'),
        ('OLAHAN', 'Barang Setengah Jadi')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

    SELECT id INTO v_cat_bahan_id FROM stock_item_categories WHERE code = 'BAHAN';
    SELECT id INTO v_cat_olahan_id FROM stock_item_categories WHERE code = 'OLAHAN';

    -- 3. Master Barang
    INSERT INTO stock_items (sku, name, category_id, uom_id, item_kind, is_stocked)
    VALUES
        ('AYAM_UTUH', 'Ayam Utuh', v_cat_bahan_id, v_uom_kg_id, 'material', TRUE),
        ('BUMBU', 'Bumbu Racik', v_cat_bahan_id, v_uom_kg_id, 'material', TRUE),
        ('AYAM_UNGKEP', 'Ayam Ungkep', v_cat_olahan_id, v_uom_kg_id, 'semi_finished', TRUE)
    ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, uom_id = EXCLUDED.uom_id
    RETURNING id;

    SELECT id INTO v_item_ayam_id FROM stock_items WHERE sku = 'AYAM_UTUH';
    SELECT id INTO v_item_bumbu_id FROM stock_items WHERE sku = 'BUMBU';
    SELECT id INTO v_item_ungkep_id FROM stock_items WHERE sku = 'AYAM_UNGKEP';

    -- 4. Master Bins
    INSERT INTO stock_bins (code, name, bin_kind, location_id, is_receiving)
    VALUES
        ('GUDANG', 'Gudang Bahan Pusat', 'receiving', v_loc_dapur_id, TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, bin_kind = EXCLUDED.bin_kind, is_receiving = TRUE
    RETURNING id INTO v_bin_gudang_id;

    INSERT INTO stock_bins (code, name, bin_kind, location_id, is_receiving)
    VALUES
        ('FREEZER', 'Freezer Penyimpanan', 'storage', v_loc_dapur_id, FALSE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, bin_kind = EXCLUDED.bin_kind, is_receiving = FALSE
    RETURNING id INTO v_bin_freezer_id;

    -- 5. Master Pihak (stock_parties)
    INSERT INTO stock_parties (code, name, party_kind, location_id)
    VALUES
        ('VENDOR_CONTOH', 'Vendor Bahan Contoh', 'vendor', NULL),
        ('OUTLET_INTERNAL', 'Outlet Baros Internal', 'internal_outlet', v_loc_baros_id),
        ('OUTLET_MITRA', 'Outlet Mitra Pihak Ketiga', 'third_party_outlet', NULL),
        ('CATERING', 'Kanal Penjualan Katering', 'catering', NULL)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, party_kind = EXCLUDED.party_kind;

    SELECT id INTO v_party_vendor_id FROM stock_parties WHERE code = 'VENDOR_CONTOH';
    SELECT id INTO v_party_outlet_int_id FROM stock_parties WHERE code = 'OUTLET_INTERNAL';
    SELECT id INTO v_party_outlet_mitra_id FROM stock_parties WHERE code = 'OUTLET_MITRA';
    SELECT id INTO v_party_catering_id FROM stock_parties WHERE code = 'CATERING';

    -- 6. Resep (BOM): 10 kg AYAM_UNGKEP dari 12 kg AYAM_UTUH dan 0,4 kg BUMBU
    SELECT id INTO v_bom_id FROM stock_boms WHERE output_item_id = v_item_ungkep_id LIMIT 1;
    IF v_bom_id IS NULL THEN
        INSERT INTO stock_boms (output_item_id, output_qty, effective_from)
        VALUES (v_item_ungkep_id, 10.000000, DATE '2026-11-09')
        RETURNING id INTO v_bom_id;

        INSERT INTO stock_bom_lines (bom_id, item_id, qty)
        VALUES
            (v_bom_id, v_item_ayam_id, 12.000000),
            (v_bom_id, v_item_bumbu_id, 0.400000);
    END IF;

    -- 7. Daftar Harga Margin
    INSERT INTO stock_price_lists (code, party_kind, margin_percent, effective_from)
    VALUES
        ('PL_OUTLET_INT', 'internal_outlet', 20.0000, DATE '2026-11-01'),
        ('PL_OUTLET_MITRA', 'third_party_outlet', 20.0000, DATE '2026-11-01'),
        ('PL_CATERING', 'catering', 30.0000, DATE '2026-11-01')
    ON CONFLICT (code) DO NOTHING;

    -- 8. Kas Dapur
    INSERT INTO cash_funds (code, name, balance)
    VALUES ('KAS_DAPUR', 'Kas Operasional Dapur Pusat', 0)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_fund_id;

    -- Cek apakah siklus contoh sudah pernah dibuat
    IF NOT EXISTS (SELECT 1 FROM purchase_requests WHERE doc_no = 'PR-CONTOH') THEN
        -- Step 1: Request Belanja PR-CONTOH (Dapur)
        INSERT INTO purchase_requests (doc_no, source_unit, status, needed_on, created_by, posted_at)
        VALUES ('PR-CONTOH', 'dapur', 'posted', DATE '2026-11-09', v_admin_id, now())
        RETURNING id INTO v_pr_id;

        INSERT INTO purchase_request_lines (request_id, item_id, qty)
        VALUES
            (v_pr_id, v_item_ayam_id, 20.000000),
            (v_pr_id, v_item_bumbu_id, 2.000000);

        -- Step 2: Pesanan Beli PO-CONTOH (Purchasing)
        INSERT INTO purchase_orders (doc_no, request_id, vendor_id, status, source_unit, created_by, posted_at)
        VALUES ('PO-CONTOH', v_pr_id, v_party_vendor_id, 'posted', 'purchasing', v_admin_id, now())
        RETURNING id INTO v_po_id;

        INSERT INTO purchase_order_lines (order_id, item_id, qty, price_hint)
        VALUES
            (v_po_id, v_item_ayam_id, 20.000000, 30000.00),
            (v_po_id, v_item_bumbu_id, 2.000000, 20000.00);

        -- Step 3: Kas Dapur terima uang muka Rp2.000.000
        INSERT INTO cash_fund_entries (fund_id, entry_kind, amount, memo, payment_id, created_by)
        VALUES (v_fund_id, 'topup', 2000000.00, 'Uang muka operasional dapur harian', NULL, v_admin_id);

        UPDATE cash_funds SET balance = balance + 2000000.00 WHERE id = v_fund_id;

        -- Step 4: Penerimaan GRN-CONTOH ke Gudang Pusat dengan Ongkir Rp32.000
        -- Barang 640.000 (Ayam 600.000, Bumbu 40.000). Alokasi ongkir: Ayam 30.000, Bumbu 2.000
        -- All-in: Ayam 630.000 (31.500/kg), Bumbu 42.000 (21.000/kg). Total 672.000
        INSERT INTO goods_receipts (doc_no, order_id, bin_id, status, hpp_method, freight_cost, other_cost, created_by, posted_at)
        VALUES ('GRN-CONTOH', v_po_id, v_bin_gudang_id, 'posted', 'moving_average', 32000.00, 0, v_admin_id, now())
        RETURNING id INTO v_grn_id;

        INSERT INTO goods_receipt_lines (receipt_id, item_id, qty, goods_value, allocated_extra, all_in_value, unit_cost)
        VALUES
            (v_grn_id, v_item_ayam_id, 20.000000, 600000.00, 30000.00, 630000.00, 31500.000000),
            (v_grn_id, v_item_bumbu_id, 2.000000, 40000.00, 2000.00, 42000.00, 21000.000000);

        -- Stock Moves penerimaan
        INSERT INTO stock_moves (item_id, bin_id, move_kind, qty, value, unit_cost, source_type, source_id)
        VALUES
            (v_item_ayam_id, v_bin_gudang_id, 'receipt', 20.000000, 630000.00, 31500.000000, 'goods_receipt', v_grn_id),
            (v_item_bumbu_id, v_bin_gudang_id, 'receipt', 2.000000, 42000.00, 21000.000000, 'goods_receipt', v_grn_id);

        -- Saldo Gudang awal
        INSERT INTO stock_balances (item_id, bin_id, qty, value, unit_cost)
        VALUES
            (v_item_ayam_id, v_bin_gudang_id, 20.000000, 630000.00, 31500.000000),
            (v_item_bumbu_id, v_bin_gudang_id, 2.000000, 42000.00, 21000.000000)
        ON CONFLICT (item_id, bin_id) DO UPDATE SET
            qty = stock_balances.qty + EXCLUDED.qty,
            value = stock_balances.value + EXCLUDED.value,
            unit_cost = EXCLUDED.unit_cost;

        -- Step 5: Hutang Vendor BILL-CONTOH Rp672.000
        INSERT INTO vendor_bills (doc_no, receipt_id, vendor_id, amount, amount_open, due_date, status)
        VALUES ('BILL-CONTOH', v_grn_id, v_party_vendor_id, 672000.00, 672000.00, DATE '2026-11-09', 'open')
        RETURNING id INTO v_bill_id;

        -- Step 6: Bayar Vendor PAY-CONTOH Rp672.000 dari Kas Dapur
        INSERT INTO vendor_payments (doc_no, bill_id, amount, paid_on, fund_id, status, created_by)
        VALUES ('PAY-CONTOH', v_bill_id, 672000.00, DATE '2026-11-09', v_fund_id, 'posted', v_admin_id)
        RETURNING id INTO v_payment_id;

        UPDATE vendor_bills SET amount_open = 0, status = 'paid' WHERE id = v_bill_id;

        INSERT INTO cash_fund_entries (fund_id, entry_kind, amount, memo, payment_id, created_by)
        VALUES (v_fund_id, 'spend', 672000.00, 'Pelunasan faktur vendor GRN-CONTOH (PO-CONTOH)', v_payment_id, v_admin_id);

        UPDATE cash_funds SET balance = balance - 672000.00 WHERE id = v_fund_id;

        -- Step 7: Produksi MO-CONTOH 10 kg Ayam Ungkep ke FREEZER
        -- Konsumsi: 12 kg Ayam (378.000) + 0,4 kg Bumbu (8.400) = 386.400 -> HPP Ungkep 38.640/kg
        INSERT INTO production_orders (doc_no, bom_id, output_qty, output_bin_id, status, total_cost, created_by, posted_at)
        VALUES ('MO-CONTOH', v_bom_id, 10.000000, v_bin_freezer_id, 'posted', 386400.00, v_admin_id, now())
        RETURNING id INTO v_mo_id;

        INSERT INTO production_lines (order_id, item_id, bin_id, qty, value)
        VALUES
            (v_mo_id, v_item_ayam_id, v_bin_gudang_id, 12.000000, 378000.00),
            (v_mo_id, v_item_bumbu_id, v_bin_gudang_id, 0.400000, 8400.00);

        -- Stock moves konsumsi & hasil
        INSERT INTO stock_moves (item_id, bin_id, move_kind, qty, value, unit_cost, source_type, source_id)
        VALUES
            (v_item_ayam_id, v_bin_gudang_id, 'consume', 12.000000, 378000.00, 31500.000000, 'production_order', v_mo_id),
            (v_item_bumbu_id, v_bin_gudang_id, 'consume', 0.400000, 8400.00, 21000.000000, 'production_order', v_mo_id),
            (v_item_ungkep_id, v_bin_freezer_id, 'produce', 10.000000, 386400.00, 38640.000000, 'production_order', v_mo_id);

        -- Potong saldo gudang
        UPDATE stock_balances
        SET qty = qty - 12.000000, value = value - 378000.00
        WHERE item_id = v_item_ayam_id AND bin_id = v_bin_gudang_id;

        UPDATE stock_balances
        SET qty = qty - 0.400000, value = value - 8400.00
        WHERE item_id = v_item_bumbu_id AND bin_id = v_bin_gudang_id;

        -- Tambah saldo freezer
        INSERT INTO stock_balances (item_id, bin_id, qty, value, unit_cost)
        VALUES (v_item_ungkep_id, v_bin_freezer_id, 10.000000, 386400.00, 38640.000000)
        ON CONFLICT (item_id, bin_id) DO UPDATE SET
            qty = stock_balances.qty + EXCLUDED.qty,
            value = stock_balances.value + EXCLUDED.value,
            unit_cost = EXCLUDED.unit_cost;

        -- Step 8A: Penjualan ke Outlet Internal (4 kg, margin 20%)
        -- Harga: 38.640 * 1,2 = 46.368. Omzet: 185.472. HPP: 154.560. Laba: 30.912
        INSERT INTO sales_orders (doc_no, party_id, status, ordered_on, created_by)
        VALUES ('SO-OUT', v_party_outlet_int_id, 'posted', DATE '2026-11-09', v_admin_id)
        RETURNING id INTO v_so_out_id;

        INSERT INTO sales_order_lines (order_id, item_id, qty)
        VALUES (v_so_out_id, v_item_ungkep_id, 4.000000);

        INSERT INTO shipments (doc_no, order_id, bin_id, status, shipped_on, posted_at)
        VALUES ('DO-OUT', v_so_out_id, v_bin_freezer_id, 'posted', DATE '2026-11-09', now())
        RETURNING id INTO v_ship_out_id;

        INSERT INTO shipment_lines (shipment_id, item_id, qty, unit_cost, cogs_value)
        VALUES (v_ship_out_id, v_item_ungkep_id, 4.000000, 38640.000000, 154560.00);

        INSERT INTO stock_moves (item_id, bin_id, move_kind, qty, value, unit_cost, source_type, source_id)
        VALUES (v_item_ungkep_id, v_bin_freezer_id, 'ship', 4.000000, 154560.00, 38640.000000, 'shipment', v_ship_out_id);

        UPDATE stock_balances
        SET qty = qty - 4.000000, value = value - 154560.00
        WHERE item_id = v_item_ungkep_id AND bin_id = v_bin_freezer_id;

        INSERT INTO sales_invoices (doc_no, shipment_id, party_id, amount, cogs_amount, status, created_by)
        VALUES ('INV-OUT', v_ship_out_id, v_party_outlet_int_id, 185472.00, 154560.00, 'posted', v_admin_id)
        RETURNING id INTO v_inv_out_id;

        INSERT INTO sales_invoice_lines (invoice_id, item_id, qty, unit_cost, unit_price, line_amount, cogs_value)
        VALUES (v_inv_out_id, v_item_ungkep_id, 4.000000, 38640.000000, 46368.000000, 185472.00, 154560.00);

        -- Step 8B: Penjualan ke Catering (3 kg, margin 30%)
        -- Harga: 38.640 * 1,3 = 50.232. Omzet: 150.696. HPP: 115.920. Laba: 34.776
        INSERT INTO sales_orders (doc_no, party_id, status, ordered_on, created_by)
        VALUES ('SO-CAT', v_party_catering_id, 'posted', DATE '2026-11-09', v_admin_id)
        RETURNING id INTO v_so_cat_id;

        INSERT INTO sales_order_lines (order_id, item_id, qty)
        VALUES (v_so_cat_id, v_item_ungkep_id, 3.000000);

        INSERT INTO shipments (doc_no, order_id, bin_id, status, shipped_on, posted_at)
        VALUES ('DO-CAT', v_so_cat_id, v_bin_freezer_id, 'posted', DATE '2026-11-09', now())
        RETURNING id INTO v_ship_cat_id;

        INSERT INTO shipment_lines (shipment_id, item_id, qty, unit_cost, cogs_value)
        VALUES (v_ship_cat_id, v_item_ungkep_id, 3.000000, 38640.000000, 115920.00);

        INSERT INTO stock_moves (item_id, bin_id, move_kind, qty, value, unit_cost, source_type, source_id)
        VALUES (v_item_ungkep_id, v_bin_freezer_id, 'ship', 3.000000, 115920.00, 38640.000000, 'shipment', v_ship_cat_id);

        UPDATE stock_balances
        SET qty = qty - 3.000000, value = value - 115920.00
        WHERE item_id = v_item_ungkep_id AND bin_id = v_bin_freezer_id;

        INSERT INTO sales_invoices (doc_no, shipment_id, party_id, amount, cogs_amount, status, created_by)
        VALUES ('INV-CAT', v_ship_cat_id, v_party_catering_id, 150696.00, 115920.00, 'posted', v_admin_id)
        RETURNING id INTO v_inv_cat_id;

        INSERT INTO sales_invoice_lines (invoice_id, item_id, qty, unit_cost, unit_price, line_amount, cogs_value)
        VALUES (v_inv_cat_id, v_item_ungkep_id, 3.000000, 38640.000000, 50232.000000, 150696.00, 115920.00);
    END IF;
END $$;


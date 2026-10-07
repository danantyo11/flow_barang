# DATABASE DOCUMENTATION & SCHEMA DESIGN

## Overview
Database dirancang dengan normalisasi tingkat 3 (3NF) dan integritas referensial penuh. Skema mendukung SQLite untuk kemudahan pengujian lokal dan PostgreSQL untuk lingkungan produksi enterprise.

---

## 1. Konfigurasi Produksi (PostgreSQL)
Untuk menggunakan PostgreSQL di server produksi:
1. Ubah variabel di `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/golden_procurement?schema=public"
   ```
2. Ubah provider di `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Jalankan migrasi:
   ```bash
   npx prisma migrate dev --name init_postgres
   ```

---

## 2. Struktur Tabel Utama

### A. Otentikasi & RBAC
- `users`: Data pengguna (NIP, nama, email, password bcrypt, role_id, department_id, status).
- `roles`: Role sistem (`ADMIN`, `REQUESTER`, `WAREHOUSE`, `PURCHASING`, `APPROVER`, `MANAGEMENT`).
- `permissions`: Izin spesifik modul & aksi.
- `role_permissions`: Pemetaan banyak-ke-banyak peran dan izin.
- `departments`: Master departemen/divisi (Maintenance, Production, Warehouse, Purchasing, Finance, GA, Engineering).

### B. Master Barang & Inventori
- `items`: Data induk barang (kode unik e.g. `MAT-00101`, nama, spesifikasi, minimum_stock, maximum_stock, reorder_point, critical_stock, is_critical).
- `item_categories`: Kategori barang (Sparepart, Material Penunjang, Bahan Baku, Consumable, Tools, Chemical, dll).
- `item_subcategories`: Subkategori barang (e.g. *Production Supporting Material* untuk Kowi).
- `units`: Master satuan (PCS, BOX, ROLL, DRUM, LTR, SET, KG).
- `warehouses`: Master gudang (WH-01 Gudang Utama, WH-02 Gudang Maintenance).
- `warehouse_locations`: Struktur rak dan bin spesifik dalam gudang.

### C. Alur Pengadaan (Procurement)
- `purchase_requests`: Header PR (pr_number, request_date, requester_id, department_id, priority, purpose, status).
- `purchase_request_items`: Detail barang PR (requested_qty, available_stock, allocated_qty, purchase_qty).
- `suppliers`: Data rekanan vendor/supplier (NPWP, payment terms, lead time).
- `supplier_quotations`: Penawaran harga vendor per PR (lead time, terms, ongkir, diskon, pajak, is_selected, alasan pemilihan).
- `supplier_quotation_items`: Rincian item harga penawaran supplier.
- `purchase_orders`: Dokumen pesanan pembelian (po_number, pr_id, supplier_id, subtotal, discount, tax, total, status, approved_by).
- `purchase_order_items`: Rincian barang PO, received_qty, and remaining_qty.

### D. Alur Persetujuan (Approval)
- `approval_flows`: Konfigurasi threshold nominal approval matrix.
- `approval_steps`: Tahapan peran approver dalam satu flow.
- `approval_instances`: Tracking status persetujuan dokumen aktif.
- `approval_logs`: Riwayat persetujuan, penolakan, dan komentar revisi.

### E. Gudang, Penerimaan, & Stock Engine
- `goods_receipts`: Penerimaan barang fisik (gr_number, po_id, supplier_id, destination: STOCK / USER_REQUEST, qc_status).
- `goods_receipt_items`: Rincian kuantitas: order_qty, received_qty, good_qty, damaged_qty, rejected_qty.
- `goods_issues`: Dokumen pengeluaran barang dari gudang (gi_number, requester_id, department_id, warehouse_id).
- `handover_documents`: Dokumen serah terima fisik barang kepada user (ho_number, receiver_name, signature_note, status).
- `stock_balances`: Saldo stok aktual per `itemId + warehouseId + locationId`.
- `stock_transactions`: Buku besar mutasi stok immutable (transaction_type, quantity, balance_before, balance_after, unit_cost).
- `direct_purchases`: Pembelian langsung non-PO dengan lampiran kuitansi/nota tunai.

### F. Sistem Pendukung
- `audit_logs`: Catatan aktivitas pengguna (user, action, module, document, old/new value, IP, timestamp).
- `notifications`: Notifikasi in-app untuk penugasan alur kerja.
- `document_sequences`: Kunci urutan penomoran otomatis anti-balapan transaksi.
- `system_settings`: Parameter kebijakan sistem.

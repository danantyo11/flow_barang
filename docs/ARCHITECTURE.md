# SYSTEM ARCHITECTURE

## GOLDEN PROCUREMENT & WAREHOUSE SYSTEM

### 1. High-Level Architectural Diagram

```
+---------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                    |
|  - React 18 + Vite + TypeScript                                                 |
|  - Tailwind CSS + Lucide Icons                                                  |
|  - Progressive Web App (Service Worker + Offline Draft Cache in LocalStorage)   |
|  - Responsive Desktop Sidebar & Mobile Bottom Touch Navigation                  |
+---------------------------------------------------------------------------------+
                                       |
                           HTTP REST / JWT Auth / JSON
                                       v
+---------------------------------------------------------------------------------+
|                                 SERVER LAYER                                    |
|  - Express.js + TypeScript (NodeNext)                                           |
|  - RBAC & JWT Authentication Middleware                                         |
|  - Zod Request Schema Validation                                                |
|  - Document Number Generator (Atomic DB Locking Sequence)                       |
|  - Core Engines:                                                                |
|      * Stock Engine (Double-entry ledger, balance calculation, negative check)  |
|      * Approval Engine (Configurable dynamic threshold matrix)                  |
|      * Notification & Audit Trail Services                                      |
+---------------------------------------------------------------------------------+
                                       |
                                   Prisma ORM
                                       v
+---------------------------------------------------------------------------------+
|                                DATABASE LAYER                                   |
|  - SQLite (Local development zero-config)                                        |
|  - PostgreSQL (Production ready via DATABASE_URL connection string)             |
|  - ACID Transactions & Strict Foreign Key Constraints                           |
+---------------------------------------------------------------------------------+
```

### 2. Core Engines Design

#### A. Stock Engine (`src/services/stockEngine.ts`)
- Menerapkan prinsip *double-entry inventory accounting*: tidak pernah mengubah saldo stok sembarangan tanpa rekam jejak transaksi.
- Setiap mutasi menghasilkan satu baris immutable di tabel `stock_transactions` dengan saldo sebelum (`balance_before`) dan saldo sesudah (`balance_after`).
- Memeriksa konfigurasi `ALLOW_NEGATIVE_STOCK` sebelum mengurangi stok. Transaksi dibatalkan secara otomatis jika stok fisik tidak mencukupi.

#### B. Document Number Generator (`src/utils/documentNumber.ts`)
- Menjamin nomor dokumen transaksi-aman (*transaction-safe*) dan urut tanpa duplikasi saat diakses multi-user secara konkuren:
  - Format: `PR-YYYYMM-0001`, `PO-YYYYMM-0001`, `GR-YYYYMM-0001`, `GI-YYYYMM-0001`, `HO-YYYYMM-0001`, `DP-YYYYMM-0001`.
  - Menggunakan tabel `document_sequences` dengan atomic increment upsert.

#### C. Configurable Approval Engine (`src/services/approvalEngine.ts`)
- Matrix approval dinamis berdasarkan nominal nilai PO (`min_amount` s/d `max_amount`).
- Mengatur alur persetujuan berjenjang:
  - Nominal < 5 Juta: 1 Step (Manager).
  - Nominal 5 Jt - 50 Jt: 2 Steps (Manager lalu General Manager).
  - Nominal > 50 Jt: 3 Steps (Manager, GM, lalu Direktur).
- Administrator dapat mengubah batas nominal dan alur tanpa mengubah kode program.

#### D. Offline-Aware Architecture
- Client mendeteksi status jaringan melalui event `online` dan `offline`.
- Saat koneksi offline, Requester tetap dapat membuka katalog master barang yang sudah di-cache serta membuat draft PR yang disimpan secara lokal.
- Ketika koneksi online pulih, client melakukan *auto-sync* draft lokal ke backend dan menampilkan indikator status `SYNCED`.

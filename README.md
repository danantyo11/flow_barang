# GOLDEN PROCUREMENT & WAREHOUSE SYSTEM

**GOLDEN PROCUREMENT & WAREHOUSE SYSTEM** adalah sistem ERP pengadaan barang (procurement) dan pergudangan (warehouse) terintegrasi berbasis web & PWA (*Progressive Web App*) production-ready.

Sistem mengontrol alur pengadaan secara menyeluruh:
$$\text{User/Divisi} \rightarrow \text{PR} \rightarrow \text{Cek Stok Gudang} \rightarrow \text{Purchasing / Cek Harga} \rightarrow \text{PO} \rightarrow \text{Approval Pimpinan} \rightarrow \text{Receiving / QC} \rightarrow \text{Stock In / Handover} \rightarrow \text{Completed}$$

---

## 🚀 Fitur Utama

- **Role-Based Access Control (RBAC)**: Role Admin, Requester/User, Warehouse, Purchasing, Approver, dan Management.
- **Workflow Permintaan Barang (PR)**: Penomoran otomatis `PR-YYYYMM-0001` dengan proteksi locking transaksi, prioritas (NORMAL, URGENT, CRITICAL).
- **Pemeriksaan Stok Gudang (Warehouse Check)**: Pemisahan alokasi stok gudang yang tersedia vs kuantitas yang wajib dibeli eksternal (tidak memaksa seluruh PR masuk purchasing).
- **Purchasing & Quotation Comparison**: Komparasi penawaran harga vendor side-by-side (harga, diskon, PPN, ongkir, lead time, terms pembayaran, alasan pemilihan).
- **Purchase Order (PO)**: Penomoran otomatis `PO-YYYYMM-0001`, perhitungan ulang total di backend (tidak percaya input frontend).
- **Approval Engine Matrix**: Threshold bertingkat fleksibel (< 5 Jt: Manager, 5 - 50 Jt: Manager + GM, > 50 Jt: Manager + GM + Direktur) yang dapat diubah administrator tanpa hardcode.
- **Receiving & Quality Check (GR / QC)**: Penomoran `GR-YYYYMM-0001`, dukungan partial receiving, inspeksi QC (PASSED, PARTIAL, REJECTED). Barang rusak/cacat **tidak pernah** masuk saldo stok gudang.
- **Double-Entry Stock Ledger Engine**: Setiap mutasi fisik menghasilkan catatan stock ledger immutable (STOCK_IN, STOCK_OUT, RECEIVING, ISSUE, ADJUSTMENT), pencatatan saldo sebelum dan sesudah (*balance before/after*), validasi pencegahan stok negatif.
- **Pengeluaran Barang (Goods Issue / GI) & Serah Terima (Handover / HO)**: Dokumen serah terima fisik dengan tanda tangan/konfirmasi digital pemohon untuk menuntaskan siklus PR menjadi *COMPLETED*.
- **PWA & Offline-First Drafts**: Service Worker caching, offline draft PR tersimpan di browser saat koneksi terputus dan sinkronisasi otomatis saat online kembali dengan indikator visual *ONLINE / OFFLINE / SYNCING*.
- **Master Data Lengkap & Aturan Kowi**: Klasifikasi khusus *Kowi* sebagai Sparepart / Production Supporting Material dengan status Critical = YA.
- **15 Laporan Lengkap**: Export Excel (.xlsx) dan cetak PDF.
- **Audit Trail & Notifikasi**: Rekam jejak seluruh aksi user beserta IP address dan user agent.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router v6.
- **Backend**: Node.js, Express, TypeScript, Zod Schema Validation, JWT, Bcrypt.
- **Database & ORM**: Prisma ORM, SQLite (local development zero-config) / PostgreSQL (production ready via DATABASE_URL).
- **Export & Tools**: SheetJS (XLSX), Multer (File Attachments), Vitest & Supertest (Testing).

---

## 👤 Akun Demo & Akses 1-Click

Semua akun dapat digunakan untuk login cepat atau 1-click switcher di halaman login:

| Role | Nama | Email | Password | Wewenang Utama |
|---|---|---|---|---|
| **ADMIN** | System Administrator | `admin@golden.local` | `admin123` | Akses penuh, Master data, User, Audit Trail, Pengaturan |
| **REQUESTER** | Budi Maintenance | `budi.maintenance@golden.local` | `user123` | Buat PR, Cek status, Konfirmasi serah terima |
| **WAREHOUSE** | Joko Gudang | `gudang@golden.local` | `user123` | Cek stok PR, Terima barang (GR), QC, Issue (GI), Kartu Stok |
| **PURCHASING** | Siti Purchasing | `purchasing@golden.local` | `user123` | Input quotation vendor, Komparasi harga, Terbitkan PO |
| **APPROVER** | Hendra Manager | `approver@golden.local` | `user123` | Review & Approve/Reject/Revisi PO berjenjang |
| **APPROVER (GM/Dir)**| Bambang Director | `director@golden.local` | `user123` | Persetujuan PO nominal besar (> 5 Juta) |
| **MANAGEMENT** | Dewi Management | `management@golden.local` | `user123` | Dashboard nilai pengadaan, spending divisi, dan laporan |

---

## 📦 Instalasi & Menjalankan Aplikasi

### 1. Prasyarat
- Node.js v18+ (disarankan Node.js v20+)
- npm v9+

### 2. Setup Server Backend
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```
Backend berjalan pada: `http://localhost:5000`

### 3. Setup Frontend Client
```bash
cd client
npm install
npm run dev
```
Frontend berjalan pada: `http://localhost:5173`

### 4. Menjalankan Seluruh Sistem (Root)
Dari folder utama:
```bash
npm run dev
```

### 5. Menjalankan Pengujian (Tests)
```bash
cd server
npm test
```
Seluruh skenario workflow integration test (In-stock, Out-of-stock, Partial receiving, RBAC) akan dijalankan secara otomatis.

---

## 📑 Demo Transaksi Sesuai Requirement (Section 42)

Data seed telah memuat transaksi end-to-end lengkap:
- **No PR**: `PR-202610-0001`
- **Pemohon**: Budi (Maintenance)
- **Item**: Bearing 6204ZZ (10 PCS)
- **Cek Gudang**: Stok = 0 → Alokasi Beli = 10 PCS
- **Quotation**: PT Mitra Perkasa Teknik (Vendor A) @ Rp 250.000
- **No PO**: `PO-202610-0001` senilai Rp 2.500.000
- **Approval**: Disetujui oleh Hendra Manager
- **No GR**: `GR-202610-0001`, Penerimaan 10 PCS, QC: PASSED, Destinasi: `USER_REQUEST`
- **No HO**: `HO-202610-0001`, Serah terima selesai (COMPLETED) dikonfirmasi oleh Budi Maintenance.

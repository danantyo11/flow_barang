# REST API SPECIFICATION

## Base URL
`http://localhost:5000/api`

Semua permintaan (kecuali endpoint login) memerlukan header:
`Authorization: Bearer <JWT_TOKEN>`

---

## 1. Otentikasi
- `POST /auth/login`
  - Body: `{ email, password }`
  - Response: `{ token, user }`
- `GET /auth/me`
  - Mengambil data profil user aktif beserta role & departemen.
- `GET /auth/users`
  - Mengambil seluruh daftar pengguna.
- `GET /auth/departments`
  - Mengambil daftar departemen perusahaan.

---

## 2. Permintaan Barang (Purchase Request)
- `GET /purchase-requests`
  - Query: `?status=...&priority=...&departmentId=...`
- `GET /purchase-requests/:id`
  - Mengambil detail PR lengkap dengan item dan alokasi stok.
- `POST /purchase-requests`
  - Body: `{ departmentId, priority, purpose, items: [{ itemId, requestedQty, unitId, estimatedPrice }] }`
- `POST /purchase-requests/:id/submit`
  - Mengirim draft PR ke Gudang.
- `POST /purchase-requests/:id/cancel`
  - Membatalkan PR sebelum diproses.
- `POST /purchase-requests/:id/warehouse-check`
  - Body: `{ items: [{ prItemId, availableStock, allocatedQty, purchaseQty, notes }] }`
  - Memisahkan alokasi stok gudang vs kuantitas beli.

---

## 3. Purchasing & Quotation
- `GET /suppliers`
  - Mengambil daftar supplier aktif.
- `GET /suppliers/quotations/:prId`
  - Mengambil perbandingan penawaran vendor untuk satu PR.
- `POST /suppliers/quotations`
  - Mencatat penawaran harga vendor.
- `POST /suppliers/quotations/:id/select`
  - Memilih quotation pemenang dengan alasan pemilihan (`selectionReason`).

---

## 4. Purchase Order & Approval
- `GET /purchase-orders`
- `GET /purchase-orders/:id`
- `POST /purchase-orders`
  - Membuat draft PO (total dihitung otomatis oleh backend).
- `POST /purchase-orders/:id/submit-approval`
  - Memicu alur approval engine matrix.
- `POST /purchase-orders/:id/send`
  - Menandai PO telah dikirim ke supplier.
- `GET /approvals/pending`
  - Mengambil daftar PO yang menunggu approval pimpinan.
- `POST /approvals/:id/approve`
  - Menyetujui tahap approval PO.
- `POST /approvals/:id/reject`
  - Menolak dokumen PO.
- `POST /approvals/:id/revision`
  - Meminta revisi penawaran/kuantitas.

---

## 5. Warehouse & Stock Engine
- `GET /goods-receipts`
- `POST /goods-receipts`
  - Body: `{ poId, destination: 'STOCK'|'USER_REQUEST', qcStatus: 'PASSED'|'PARTIAL'|'REJECTED', items: [{ itemId, warehouseId, orderQty, receivedQty, goodQty, damagedQty, rejectedQty }] }`
- `POST /goods-issues`
  - Body: `{ warehouseId, requesterId, departmentId, items: [{ itemId, quantity, unitId }] }`
  - Mengurangi stok fisik di ledger gudang.
- `GET /handovers`
- `POST /handovers/:id/confirm`
  - Konfirmasi penerimaan fisik oleh user (menuntaskan siklus PR ke `COMPLETED`).
- `GET /stock/balances`
  - Monitoring stok real-time beserta status `CRITICAL` dan `LOW_STOCK`.
- `GET /stock/card/:itemId`
  - Mengambil kartu stok kronologis dan running balance per barang.
- `POST /stock/adjust`
  - Penyesuaian stok manual (Adjustment In/Out).

---

## 6. Laporan, Pencarian, & Audit
- `GET /reports/:reportType?format=json|excel`
  - Unduh laporan dalam JSON atau file Excel (.xlsx).
- `GET /search?q=keyword`
  - Pencarian global di seluruh dokumen PR, PO, GR, GI, Barang, dan Supplier.
- `GET /audit-logs`
  - Menampilkan audit trail riwayat seluruh aktivitas pengguna.

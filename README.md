# flow_barang

Aplikasi Permohonan Barang (Goods Request System) berbasis Role-Based Access Control (RBAC) dan Dynamic Threshold Routing.

## Fitur Utama
- **Two-Phase Approval Workflow**:
  - **Fase PR (Purchase Request)**: Petugas ➔ Gudang (Cek Fisik Stok) ➔ Approver Berjenjang (Dynamic Threshold).
  - **Fase PO (Purchase Order)**: Purchasing Buat Draft PO ➔ Otorisasi Minimal Manager (Level 6+) ➔ Release ke Vendor.
  - **Otomatisasi Penerimaan Gudang**: Saat PO diterbitkan ke vendor, tiket penerimaan barang (`goods_receipts`) otomatis masuk ke antrean user Gudang.
- **Modul Admin SYST000**:
  - User & Role Management.
  - Master Dynamic PR Threshold Limit (Role Level 3 s/d 8).
  - Validasi PO Approval Enforcement (Level >= 6).
- **Skema Database Relasional Lengkap**: DDL SQL PostgreSQL/MySQL dengan audit trail approval logs.

# WORKFLOW & BUSINESS PROCESS

## GOLDEN PROCUREMENT & WAREHOUSE SYSTEM

### 1. Diagram Alur Lengkap

```
                         +--------------------+
                         |  REQUESTER / USER  |
                         |   Buat PR (Draft)  |
                         +--------------------+
                                   |
                                   v
                         +--------------------+
                         |     SUBMIT PR      |
                         +--------------------+
                                   |
                                   v
                         +--------------------+
                         |  WAREHOUSE CHECK   |
                         |  Pemeriksaan Stok  |
                         +--------------------+
                                   |
                +------------------+------------------+
                |                                     |
                v                                     v
       [Stok Tersedia Semua]                [Stok Kurang / Tidak Ada]
                |                                     |
                v                                     v
        +---------------+                     +---------------+
        |  STOCK ISSUE  |                     |  PROCUREMENT  |
        |  (GI Dokumen) |                     |   Sourcing    |
        +---------------+                     +---------------+
                |                                     |
                v                                     v
        +---------------+                     +---------------+
        |    HANDOVER   |                     |   QUOTATION   |
        | Konfirmasi HO |                     |  Perbandingan |
        +---------------+                     +---------------+
                |                                     |
                v                                     v
        +---------------+                     +---------------+
        |   COMPLETED   |                     | CREATE PO &   |
        +---------------+                     |   APPROVAL    |
                                              +---------------+
                                                      |
                                                      v
                                              +---------------+
                                              | PO DISETUJUI  |
                                              | Kirim Vendor  |
                                              +---------------+
                                                      |
                                                      v
                                              +---------------+
                                              | RECEIVING(GR) |
                                              |  Inspeksi QC  |
                                              +---------------+
                                                      |
                                    +-----------------+-----------------+
                                    |                                   |
                                    v                                   v
                           [Destinasi: STOCK]                [Destinasi: USER_REQUEST]
                                    |                                   |
                                    v                                   v
                             +---------------+                   +---------------+
                             |   STOCK IN    |                   |    HANDOVER   |
                             | Masuk Gudang  |                   | Konfirmasi HO |
                             +---------------+                   +---------------+
                                                                        |
                                                                        v
                                                                 +---------------+
                                                                 |   COMPLETED   |
                                                                 +---------------+
```

---

## 2. Rincian Skenario Alur Kerja

### Skenario 1: Kebutuhan Tersedia Penuh di Gudang (In-Stock)
1. User Maintenance membuat PR: 2 Roll Amplas P80.
2. Warehouse melakukan stock checking: Stok di gudang mencukupi (2 roll).
3. Status PR otomatis beralih menjadi `STOCK_ISSUE`.
4. Petugas gudang menerbitkan dokumen pengeluaran `GI-YYYYMM-XXXX`. Saldo stok Amplas P80 di kartu stok langsung terpotong.
5. Dokumen serah terima `HO-YYYYMM-XXXX` diterbitkan.
6. User melakukan konfirmasi penerimaan fisik. Status PR tuntas menjadi `COMPLETED`.

### Skenario 2: Kebutuhan Tidak Ada di Stok (Out-of-Stock)
1. User Maintenance membuat PR: 10 PCS Bearing 6204ZZ.
2. Warehouse melakukan pemeriksaan: Stok fisik = 0. Alokasi pembelian = 10 PCS.
3. PR beralih ke bagian Purchasing (`WAITING_PRICE`).
4. Bagian Purchasing memasukkan penawaran dari vendor:
   - Vendor A: Rp 250.000 / PCS (Lead time 3 hari).
   - Vendor B: Rp 270.000 / PCS (Lead time 7 hari).
5. Purchasing memilih Vendor A dengan alasan harga terbaik dan lead time cepat.
6. Purchasing membuat `PO-YYYYMM-XXXX` senilai Rp 2.500.000.
7. PO diajukan untuk persetujuan (Approval) pimpinan.
8. Approver memeriksa rincian PO dan menyetujui (Status PO: `APPROVED`).
9. Purchasing mengirimkan PO ke Vendor A (Status PO: `SENT`).
10. Barang tiba di gudang. Warehouse membuat dokumen `GR-YYYYMM-XXXX`.
11. Warehouse melakukan Quality Check (QC): 10 PCS Baik (PASSED), 0 Rusak.
12. Destinasi dipilih `USER_REQUEST` untuk langsung diserahkan kepada pemohon.
13. Pemohon menandatangani konfirmasi `HO-YYYYMM-XXXX`. Alur selesai (`COMPLETED`).

### Skenario 3: Pemenuhan Sebagian (Partial Allocation & Partial Receiving)
1. User membuat PR: 100 Box Baut M10.
2. Warehouse memeriksa stok: Tersedia 40 box di rak, kekurangan 60 box.
3. Alokasi dibuat terpisah:
   - 40 Box dipenuhi langsung dari stok gudang (Stock Issue).
   - 60 Box diteruskan ke Purchasing untuk diterbitkan PO.
4. Saat pesanan tiba:
   - Pengiriman ke-1: Datang 30 Box. Status PO menjadi `PARTIALLY_RECEIVED`.
   - Pengiriman ke-2: Datang 30 Box sisanya. Status PO tuntas menjadi `FULLY_RECEIVED`.

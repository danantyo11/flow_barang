# PT. Golden Alura Refineri (GAR) - Goods Request System

Aplikasi Permohonan Barang (*Goods Request System*) resmi untuk **PT. Golden Alura Refineri (GAR)** yang berlokasi di:
> **Kawasan Industri SIER, Jl. Rungkut Industri IV No.10, Kutisari, Kec. Tenggilis Mejoyo, Surabaya, Jawa Timur 60291**

Sistem ini mengintegrasikan **Role-Based Access Control (RBAC)**, **Dynamic Threshold Routing**, otentikasi **Stateless JWT**, serta antarmuka desktop **Windows 11 Fluent UI**.

---


## 🚀 Cara Menjalankan Aplikasi di Windows

Aplikasi dapat dijalankan dengan **sangat mudah**:

### Cara 1: Menggunakan File Batch (Satu Kali Klik)
Cukup klik ganda (*double click*) file:
```
Buka-FlowRequest.bat
```
Script ini akan otomatis memeriksa server backend, menyalakannya jika belum aktif, dan langsung membuka jendela aplikasi desktop Windows yang berdiri sendiri (*standalone desktop window* tanpa bilah peramban).

### Cara 2: Melalui Terminal / Command Prompt
```bash
# Jalankan backend dan buka jendela desktop Windows:
npm start

# Atau jalankan server saja:
npm run server
```
Aplikasi dapat diakses di: **`http://localhost:3300`**

---

## 🌟 Fitur Utama & Modul Sistem

### 1. Halaman Login Windows 11 Fluent UI & Akses Pengguna
- **Antarmuka Login Elegan**: Kartu frosted-glass acrylic berpusat dengan ikon aplikasi dan wallpaper Windows 11.
- **Form Otentikasi**: Input Username/Email, input Password dengan tombol intip sandi (toggle eye), dan opsi "Ingat sesi di perangkat ini".
- **Fitur Masuk Cepat (Quick Demo Login)**: Tombol chip 1-klik untuk langsung login sebagai 10 profil peran berbeda tanpa perlu mengetik manual:
  | Username | Password | Nama Pengguna | Peran / Jabatan | Level |
  |:---|:---|:---|:---|:---:|
  | `ahmad` | `password123` | Ahmad Nurul | Petugas (Requestor IT) | Level 1 |
  | `joko_gudang` | `password123` | Joko Susilo | Gudang (Stock & QC) | Level 2 |
  | `budi_spv` | `password123` | Budi Santoso | Supervisor (PR Approver L1) | Level 3 |
  | `siti_kabag` | `password123` | Siti Rahma, S.T. | Kepala Bagian (PR Approver L2) | Level 4 |
  | `hendra_asmen` | `password123` | Hendra Wijaya, M.M. | Asisten Manager (PR Approver L3) | Level 5 |
  | `bambang_mgr` | `password123` | Ir. Bambang Hartono | Manager (PR & Min. PO Approver) | Level 6 |
  | `diana_dir` | `password123` | Dr. Diana Kusuma | Direktur Keuangan & Ops | Level 7 |
  | `gunawan_dirut` | `password123` | Prof. Gunawan Wibisono | Direktur Utama (CEO) | Level 8 |
  | `maya_purchasing` | `password123` | Maya Sartika | Purchasing (Pengadaan) | Level 9 |
  | `admin` | `password123` | System Administrator | Superadmin Sistem | Level 0 |
- **Tombol Keluar (Logout)**: Tersedia di bilah atas (*titlebar*) dan di sudut bawah menu samping (*sidebar footer*).

### 2. Desain Desktop Windows 11 Fluent UI
- **Windows Title Bar**: Dilengkapi tombol kontrol jendela (*Minimize, Maximize, Close*), ikon aplikasi, status sesi pengguna aktif, dan tombol logout.
- **Fluent Navigation Rail**: Panel samping (*sidebar*) dengan indikator *badge notification* transaksi pending yang dinamis.
- **Multi-Role Simulator**: Bar navigasi atas untuk berpindah peran seketika (Requestor, Gudang, Supervisor, Kabag, Asmen, Manager, Direktur, Dirut, Purchasing, SYST000).
- **Windows Action Center Toasts**: Notifikasi popup meluncur dari sudut kanan bawah saat setiap aksi berhasil.
- **Pratinjau Cetak Resmi Perusahaan (Windows Print Dialog Ctrl+P)**: Cetak otomatis format Memo Permohonan PR dan Surat Pesanan PO dengan kop surat resmi dan 4 kotak tanda tangan otorisasi.

### 2. Two-Phase Approval Workflow Lengkap
- **Fase 1: Permohonan Barang (PR)**:
  - **Petugas (Level 1)**: Mengisi form PR dinamis dengan live kalkulator subtotal dan diagram prediksi eskalasi otomatis.
  - **Gudang (Level 2)**: Memverifikasi stok rak fisik. Jika barang lengkap, langsung berstatus `FULFILLED_BY_STOCK`. Jika kurang/kosong, kuantitas beli `qty_to_buy` diteruskan ke Supervisor.
  - **Approver Berjenjang (Level 3 s/d 8)**: *Dynamic Threshold Routing Engine*:
    - **Level 3 (Supervisor)**: Batas s/d Rp 5.000.000
    - **Level 4 (Kepala Bagian)**: Batas s/d Rp 20.000.000
    - **Level 5 (Asisten Manager)**: Batas s/d Rp 50.000.000
    - **Level 6 (Manager)**: Batas s/d Rp 250.000.000 & Minimal Hak Otorisasi PO
    - **Level 7 (Direktur)**: Batas s/d Rp 1.000.000.000
    - **Level 8 (Direktur Utama)**: Tanpa Batas Atas (Unlimited)
    - Jika nominal $\le$ limit approver: status menjadi `APPROVED` (final).
    - Jika nominal $>$ limit approver: dokumen secara otomatis dinaikkan ke level berikutnya ($k+1$).
- **Fase 2: Purchase Order (PO)**:
  - **Purchasing (Level 9)**: Menarik PR yang sudah `APPROVED`, memilih vendor rekanan, termin pembayaran, dan menghitung PPN 11%.
  - **Enforce Otorisasi Minimal Level 6**: Dokumen PO **hanya dapat disetujui** oleh pimpinan dengan peran minimal Manager (Level 6 ke atas). Level di bawah 6 diblokir otomatis dengan kode `403 Forbidden`.
  - **Auto-Generated Goods Receipt**: Saat Purchasing menekan tombol *Release PO to Vendor*, sistem secara **otomatis menerbitkan tiket penerimaan barang (`goods_receipts`)** ke antrean staf Gudang.
- **Fase 3: Penerimaan Fisik Gudang & QC**:
  - Petugas Gudang mencatat Nomor Surat Jalan vendor (*Delivery Order*), memverifikasi kuantitas tiba, lolos QC (*Accepted*), dan cacat/retur (*Rejected*), serta menentukan rak bin gudang.
  - Saat barang diterima lengkap, status berubah menjadi `RECEIVED_COMPLETED`, dan secara otomatis menutup siklus PO dan PR menjadi `COMPLETED`.

### 3. Modul Superadmin (SYST000)
- **Konfigurasi Dynamic Threshold Limit**: Mengubah plafon batas nominal wewenang untuk Level 3 sampai 8 dengan audit trail pembaruan.
- **Manajemen Pengguna (User Management)**: Tambah karyawan baru, penempatan departemen, dan aktivasi/deaktivasi akun.

### 4. Jejak Audit (Audit Trail & Immutable Logs)
- Seluruh mutasi dokumen (PR, PO, Goods Receipt, perubahan konfigurasi limit) dicatat secara terperinci lengkap dengan stempel waktu (WIB), pelaku (*actor & role*), jenis aksi, status sebelum, dan status sesudah.

---

## 📁 Struktur Berkas Proyek

```
Flowrequest barang/
├── Buka-FlowRequest.bat     # Launcher satu-klik untuk Windows Explorer
├── desktop-launcher.js      # Peluncur backend & jendela desktop Windows
├── server.js                # Server backend Express & API Workflow RBAC
├── package.json             # Konfigurasi dependensi & npm scripts
├── data/
│   ├── database.json        # Database lokal persisten (termasuk initial seed)
│   └── seed.js              # Inisialisasi awal database relasional
├── public/                  # Antarmuka Desktop Windows 11 Fluent UI
│   ├── index.html           # Struktur layout Windows 11 Fluent App
│   ├── style.css            # Stylesheet Windows Fluent UI & Print Layout
│   └── app.js               # Reactive state logic & integrasi API
├── database/
│   └── schema.sql           # Skema DDL Relasional PostgreSQL / MySQL
├── docs/                    # Spesifikasi arsitektur & desain UI
│   ├── ARCHITECTURE.md      # Arsitektur sistem & Two-Phase Workflow
│   ├── APPROVAL_UI_SPEC.md  # Spesifikasi UI Level Approval & Otorisasi
│   ├── approval-ui-prototype.html # Prototipe interaktif UI Approval
│   └── user-ui-prototype.html     # Prototipe interaktif UI Petugas / Requestor
└── src/                     # TypeScript types, services, & controllers
```

---

## 📖 Dokumentasi & Prototipe Antarmuka
- **Portal Pemohon (Petugas / Requestor)**:
  - Spesifikasi: [UI_DESIGN_SPEC.md](file:///d:/GAR/Flowrequest%20barang/docs/UI_DESIGN_SPEC.md)
  - Prototipe Interaktif: [user-ui-prototype.html](file:///d:/GAR/Flowrequest%20barang/docs/user-ui-prototype.html)
- **Portal Otorisasi & Level Approval (Pimpinan Level 3 s/d 8 & SYST000)**:
  - Spesifikasi: [APPROVAL_UI_SPEC.md](file:///d:/GAR/Flowrequest%20barang/docs/APPROVAL_UI_SPEC.md)
  - Prototipe Interaktif: [approval-ui-prototype.html](file:///d:/GAR/Flowrequest%20barang/docs/approval-ui-prototype.html)
- **Arsitektur Sistem**: [ARCHITECTURE.md](file:///d:/GAR/Flowrequest%20barang/docs/ARCHITECTURE.md)


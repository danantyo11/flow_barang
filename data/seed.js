const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.json');

const initialData = {
  departments: [
    { id: 1, code: 'IT', name: 'Teknologi Informasi', is_active: true },
    { id: 2, code: 'FIN', name: 'Keuangan & Akuntansi', is_active: true },
    { id: 3, code: 'OPS', name: 'Operasional & Umum', is_active: true },
    { id: 4, code: 'HRD', name: 'Sumber Daya Manusia', is_active: true },
    { id: 5, code: 'MKT', name: 'Pemasaran & Penjualan', is_active: true },
    { id: 6, code: 'LOG', name: 'Logistik & Gudang', is_active: true }
  ],
  roles: [
    { id: 1, role_code: 'SYST000', role_name: 'Admin Sistem / Superadmin', level: 0, can_approve_pr: false, can_approve_po: false, description: 'Konfigurasi master matriks & user' },
    { id: 2, role_code: 'REQUESTOR', role_name: 'Petugas (Requestor)', level: 1, can_approve_pr: false, can_approve_po: false, description: 'Pembuat pengajuan barang' },
    { id: 3, role_code: 'GUDANG', role_name: 'Gudang (Stock Verifier & QC)', level: 2, can_approve_pr: false, can_approve_po: false, description: 'Pengecek stok awal & penerima barang fisik' },
    { id: 4, role_code: 'SUPERVISOR', role_name: 'Supervisor', level: 3, can_approve_pr: true, can_approve_po: false, description: 'PR Approver Level 1 (s/d 5 Jt)' },
    { id: 5, role_code: 'KEPALA_BAGIAN', role_name: 'Kepala Bagian', level: 4, can_approve_pr: true, can_approve_po: false, description: 'PR Approver Level 2 (s/d 20 Jt)' },
    { id: 6, role_code: 'ASISTEN_MANAGER', role_name: 'Asisten Manager', level: 5, can_approve_pr: true, can_approve_po: false, description: 'PR Approver Level 3 (s/d 50 Jt)' },
    { id: 7, role_code: 'MANAGER', role_name: 'Manager', level: 6, can_approve_pr: true, can_approve_po: true, description: 'PR Approver L4 & Minimal PO Approver (s/d 250 Jt)' },
    { id: 8, role_code: 'DIREKTUR', role_name: 'Direktur', level: 7, can_approve_pr: true, can_approve_po: true, description: 'PR Approver L5 & PO Approver (s/d 1 Miliar)' },
    { id: 9, role_code: 'DIREKTUR_UTAMA', role_name: 'Direktur Utama', level: 8, can_approve_pr: true, can_approve_po: true, description: 'PR Approver Final L6 & PO Approver (Unlimited)' },
    { id: 10, role_code: 'PURCHASING', role_name: 'Purchasing (Pengadaan)', level: 9, can_approve_pr: false, can_approve_po: false, description: 'Pembuat PO & penerbit ke vendor' }
  ],
  users: [
    { id: 1, username: 'admin', email: 'admin@flowrequest.local', full_name: 'System Administrator (SYST000)', role_id: 1, role_code: 'SYST000', role_level: 0, role_name: 'Admin Sistem', department_id: 1, department_name: 'Teknologi Informasi', is_active: true },
    { id: 2, username: 'ahmad', email: 'ahmad@flowrequest.local', full_name: 'Ahmad Nurul', role_id: 2, role_code: 'REQUESTOR', role_level: 1, role_name: 'Petugas (Requestor)', department_id: 1, department_name: 'Teknologi Informasi', is_active: true },
    { id: 3, username: 'joko_gudang', email: 'joko@flowrequest.local', full_name: 'Joko Susilo', role_id: 3, role_code: 'GUDANG', role_level: 2, role_name: 'Gudang (Stock Verifier)', department_id: 6, department_name: 'Logistik & Gudang', is_active: true },
    { id: 4, username: 'budi_spv', email: 'budi@flowrequest.local', full_name: 'Budi Santoso', role_id: 4, role_code: 'SUPERVISOR', role_level: 3, role_name: 'Supervisor', department_id: 1, department_name: 'Teknologi Informasi', is_active: true },
    { id: 5, username: 'siti_kabag', email: 'siti@flowrequest.local', full_name: 'Siti Rahma, S.T.', role_id: 5, role_code: 'KEPALA_BAGIAN', role_level: 4, role_name: 'Kepala Bagian', department_id: 1, department_name: 'Teknologi Informasi', is_active: true },
    { id: 6, username: 'hendra_asmen', email: 'hendra@flowrequest.local', full_name: 'Hendra Wijaya, M.M.', role_id: 6, role_code: 'ASISTEN_MANAGER', role_level: 5, role_name: 'Asisten Manager', department_id: 3, department_name: 'Operasional & Umum', is_active: true },
    { id: 7, username: 'bambang_mgr', email: 'bambang@flowrequest.local', full_name: 'Ir. Bambang Hartono', role_id: 7, role_code: 'MANAGER', role_level: 6, role_name: 'Manager', department_id: 3, department_name: 'Operasional & Umum', is_active: true },
    { id: 8, username: 'diana_dir', email: 'diana@flowrequest.local', full_name: 'Dr. Diana Kusuma', role_id: 8, role_code: 'DIREKTUR', role_level: 7, role_name: 'Direktur Keuangan & Ops', department_id: 2, department_name: 'Keuangan & Akuntansi', is_active: true },
    { id: 9, username: 'gunawan_dirut', email: 'gunawan@flowrequest.local', full_name: 'Prof. Dr. Gunawan Wibisono', role_id: 9, role_code: 'DIREKTUR_UTAMA', role_level: 8, role_name: 'Direktur Utama (CEO)', department_id: 3, department_name: 'Direksi Eksekutif', is_active: true },
    { id: 10, username: 'maya_purchasing', email: 'maya@flowrequest.local', full_name: 'Maya Sartika', role_id: 10, role_code: 'PURCHASING', role_level: 9, role_name: 'Purchasing (Pengadaan)', department_id: 3, department_name: 'Operasional & Umum', is_active: true }
  ],
  approval_limits: [
    { id: 1, role_id: 4, level: 3, role_name: 'Supervisor', min_amount: 0, max_amount: 5000000, is_active: true, updated_by_name: 'System Default' },
    { id: 2, role_id: 5, level: 4, role_name: 'Kepala Bagian', min_amount: 5000001, max_amount: 20000000, is_active: true, updated_by_name: 'System Default' },
    { id: 3, role_id: 6, level: 5, role_name: 'Asisten Manager', min_amount: 20000001, max_amount: 50000000, is_active: true, updated_by_name: 'System Default' },
    { id: 4, role_id: 7, level: 6, role_name: 'Manager', min_amount: 50000001, max_amount: 250000000, is_active: true, updated_by_name: 'System Default' },
    { id: 5, role_id: 8, level: 7, role_name: 'Direktur', min_amount: 250000001, max_amount: 1000000000, is_active: true, updated_by_name: 'System Default' },
    { id: 6, role_id: 9, level: 8, role_name: 'Direktur Utama', min_amount: 1000000001, max_amount: 999999999999, is_active: true, updated_by_name: 'System Default' }
  ],
  vendors: [
    { id: 1, vendor_code: 'VND-001', name: 'PT Surya Abadi Digital', address: 'Kawasan Niaga Sudirman Lt. 4, Jakarta Pusat', phone: '021-5582910', email: 'sales@suryaabadidigital.co.id', tax_id: '01.234.567.8-012.000', payment_terms: 'Net 30 Days', is_active: true },
    { id: 2, vendor_code: 'VND-002', name: 'CV Mitra Usaha Solusindo', address: 'Jl. Pemuda No. 45, Surabaya', phone: '031-8941234', email: 'info@mitrausahasolusindo.com', tax_id: '02.456.789.1-034.000', payment_terms: 'Net 14 Days', is_active: true },
    { id: 3, vendor_code: 'VND-003', name: 'PT Graha Sentosa Komputer', address: 'Harco Mangga Dua Blok B2 No. 15, Jakarta Utara', phone: '021-6288900', email: 'order@grahasentosa.co.id', tax_id: '03.789.012.3-056.000', payment_terms: 'COD / Cash On Delivery', is_active: true }
  ],
  requests: [
    {
      id: 1,
      pr_number: 'PR-202610-001',
      requestor_id: 2,
      requestor_name: 'Ahmad Nurul',
      department_id: 1,
      department_name: 'Teknologi Informasi',
      request_date: '2026-10-14',
      required_date: '2026-10-22',
      purpose: 'Penggantian 2 unit laptop workstation programmer dan peripheral docking station tim backend.',
      urgency: 'TINGGI',
      status: 'APPROVED',
      total_estimated_amount: 38500000,
      total_need_purchase_amount: 38500000,
      current_approval_level: null,
      final_approver_id: 7,
      final_approver_name: 'Ir. Bambang Hartono (Manager)',
      approved_at: '2026-10-15T10:30:00Z',
      items: [
        { id: 1, item_name: 'Laptop Workstation ThinkPad T14 Gen 4', specification: 'Intel Core i7-1365U, 32GB RAM, 1TB NVMe, Win 11 Pro', qty_requested: 2, unit: 'Unit', estimated_unit_price: 18500000, total_estimated_price: 37000000, warehouse_stock_qty: 0, qty_to_buy: 2, warehouse_notes: 'Stok kosong di rak IT.' },
        { id: 2, item_name: 'USB-C Universal Docking Station', specification: 'Triple Display 4K 60Hz, 100W Power Delivery', qty_requested: 2, unit: 'Unit', estimated_unit_price: 750000, total_estimated_price: 1500000, warehouse_stock_qty: 0, qty_to_buy: 2, warehouse_notes: 'Stok habis.' }
      ]
    },
    {
      id: 2,
      pr_number: 'PR-202610-002',
      requestor_id: 2,
      requestor_name: 'Ahmad Nurul',
      department_id: 1,
      department_name: 'Teknologi Informasi',
      request_date: '2026-10-15',
      required_date: '2026-10-25',
      purpose: 'Pengadaan Server Rak Rackmount 2U untuk Database Backup Cluster dan Switch Core 24-Port 10G SFP+.',
      urgency: 'MENDESAK',
      status: 'PENDING_APPROVAL',
      total_estimated_amount: 145000000,
      total_need_purchase_amount: 145000000,
      current_approval_level: 6, // Sedang di Manager L6 (limit s/d 250jt)
      final_approver_id: null,
      final_approver_name: null,
      approved_at: null,
      items: [
        { id: 3, item_name: 'Dell PowerEdge R750 2U Rack Server', specification: 'Dual Xeon Gold 5318Y, 128GB ECC RAM, 4x 1.92TB SAS SSD RAID 10', qty_requested: 1, unit: 'Unit', estimated_unit_price: 125000000, total_estimated_price: 125000000, warehouse_stock_qty: 0, qty_to_buy: 1, warehouse_notes: 'Item khusus server, tidak di-stok di gudang.' },
        { id: 4, item_name: 'Switch Core Managed 24-Port SFP+ 10Gbps', specification: 'Layer 3 Managed Enterprise Switch, Redundant PSU', qty_requested: 1, unit: 'Unit', estimated_unit_price: 20000000, total_estimated_price: 20000000, warehouse_stock_qty: 0, qty_to_buy: 1, warehouse_notes: 'Stok kosong.' }
      ]
    },
    {
      id: 3,
      pr_number: 'PR-202610-003',
      requestor_id: 2,
      requestor_name: 'Ahmad Nurul',
      department_id: 1,
      department_name: 'Teknologi Informasi',
      request_date: '2026-10-16',
      required_date: '2026-10-20',
      purpose: 'Perlengkapan ATK bulanan Divisi IT dan toner printer laser multifungsi.',
      urgency: 'NORMAL',
      status: 'SUBMITTED_TO_GUDANG',
      total_estimated_amount: 3200000,
      total_need_purchase_amount: 3200000,
      current_approval_level: null,
      final_approver_id: null,
      final_approver_name: null,
      approved_at: null,
      items: [
        { id: 5, item_name: 'Kertas HVS A4 80gr PaperOne', specification: 'Rim 500 lembar warna putih bersih', qty_requested: 10, unit: 'Rim', estimated_unit_price: 55000, total_estimated_price: 550000, warehouse_stock_qty: 0, qty_to_buy: 10, warehouse_notes: '' },
        { id: 6, item_name: 'Cartridge Toner HP LaserJet 85A Original', specification: 'Black Toner Cartridge CE285A', qty_requested: 2, unit: 'Pcs', estimated_unit_price: 1325000, total_estimated_price: 2650000, warehouse_stock_qty: 0, qty_to_buy: 2, warehouse_notes: '' }
      ]
    },
    {
      id: 4,
      pr_number: 'PR-202610-004',
      requestor_id: 2,
      requestor_name: 'Ahmad Nurul',
      department_id: 1,
      department_name: 'Teknologi Informasi',
      request_date: '2026-10-10',
      required_date: '2026-10-15',
      purpose: 'Permintaan kabel HDMI 2.1 & Mouse Logitech untuk ruang rapat direksi.',
      urgency: 'NORMAL',
      status: 'FULFILLED_BY_STOCK',
      total_estimated_amount: 850000,
      total_need_purchase_amount: 0,
      current_approval_level: null,
      final_approver_id: 3,
      final_approver_name: 'Joko Susilo (Gudang)',
      approved_at: '2026-10-11T09:00:00Z',
      items: [
        { id: 7, item_name: 'Kabel HDMI 2.1 Braided 3 Meter 8K', specification: 'Ultra High Speed 48Gbps', qty_requested: 2, unit: 'Pcs', estimated_unit_price: 175000, total_estimated_price: 350000, warehouse_stock_qty: 5, qty_to_buy: 0, warehouse_notes: 'Stok rak E-03 tersedia 5 pcs, dipenuhi langsung 2 pcs.' },
        { id: 8, item_name: 'Wireless Mouse Logitech M331 Silent', specification: 'Optical Wireless 2.4GHz USB Nano', qty_requested: 2, unit: 'Unit', estimated_unit_price: 250000, total_estimated_price: 500000, warehouse_stock_qty: 4, qty_to_buy: 0, warehouse_notes: 'Stok rak D-02 tersedia 4 pcs, dipenuhi langsung 2 pcs.' }
      ]
    }
  ],
  purchase_orders: [
    {
      id: 1,
      po_number: 'PO-202610-001',
      request_id: 1,
      pr_number: 'PR-202610-001',
      purchasing_user_id: 10,
      purchasing_user_name: 'Maya Sartika',
      vendor_id: 1,
      vendor_name: 'PT Surya Abadi Digital',
      vendor_phone: '021-5582910',
      vendor_address: 'Kawasan Niaga Sudirman Lt. 4, Jakarta Pusat',
      po_date: '2026-10-15',
      delivery_date: '2026-10-22',
      payment_terms: 'Net 30 Days',
      subtotal: 38500000,
      tax_rate: 11,
      tax_amount: 4235000,
      grand_total: 42735000,
      status: 'RELEASED_TO_VENDOR',
      approved_by_user_id: 7,
      approved_by_name: 'Ir. Bambang Hartono (Manager L6)',
      approved_at: '2026-10-15T14:20:00Z',
      po_approval_notes: 'Disetujui. Pastikan garansi resmi Lenovo Indonesia 3 tahun onsite.',
      released_at: '2026-10-15T15:00:00Z',
      items: [
        { id: 1, request_item_id: 1, item_name: 'Laptop Workstation ThinkPad T14 Gen 4', specification: 'Intel Core i7-1365U, 32GB RAM, 1TB NVMe', qty: 2, unit: 'Unit', unit_price: 18500000, total_price: 37000000 },
        { id: 2, request_item_id: 2, item_name: 'USB-C Universal Docking Station', specification: 'Triple Display 4K 60Hz, 100W PD', qty: 2, unit: 'Unit', unit_price: 750000, total_price: 1500000 }
      ]
    }
  ],
  goods_receipts: [
    {
      id: 1,
      receipt_number: 'GR-202610-001',
      po_id: 1,
      po_number: 'PO-202610-001',
      vendor_name: 'PT Surya Abadi Digital',
      warehouse_user_id: null,
      warehouse_user_name: null,
      vendor_delivery_note_number: null,
      received_date: null,
      status: 'WAITING_RECEIPT',
      receiving_notes: 'Menunggu kedatangan fisik barang dari vendor PT Surya Abadi Digital sesuai PO-202610-001.',
      created_at: '2026-10-15T15:00:00Z',
      items: [
        { id: 1, goods_receipt_id: 1, po_item_id: 1, item_name: 'Laptop Workstation ThinkPad T14 Gen 4', qty_ordered: 2, qty_received: 0, qty_accepted: 0, qty_rejected: 0, warehouse_bin_location: 'IT-RACK-01', item_condition_notes: '' },
        { id: 2, goods_receipt_id: 1, po_item_id: 2, item_name: 'USB-C Universal Docking Station', qty_ordered: 2, qty_received: 0, qty_accepted: 0, qty_rejected: 0, warehouse_bin_location: 'IT-RACK-03', item_condition_notes: '' }
      ]
    }
  ],
  approval_logs: [
    { id: 1, timestamp: '2026-10-14T09:15:00Z', document_type: 'PR', document_number: 'PR-202610-001', actor_name: 'Ahmad Nurul', actor_role: 'REQUESTOR', action: 'SUBMIT_PR', previous_status: 'DRAFT', new_status: 'SUBMITTED_TO_GUDANG', notes: 'Pengajuan kebutuhan laptop programmer dan docking station.' },
    { id: 2, timestamp: '2026-10-14T11:00:00Z', document_type: 'PR', document_number: 'PR-202610-001', actor_name: 'Joko Susilo', actor_role: 'GUDANG', action: 'VERIFY_STOCK', previous_status: 'SUBMITTED_TO_GUDANG', new_status: 'PENDING_APPROVAL', notes: 'Stok fisik gudang nihil. Dialihkan ke alur persetujuan berjenjang Level 3 (Supervisor).' },
    { id: 3, timestamp: '2026-10-14T14:30:00Z', document_type: 'PR', document_number: 'PR-202610-001', actor_name: 'Budi Santoso', actor_role: 'SUPERVISOR (L3)', action: 'ESCALATE_PR', previous_status: 'PENDING_APPROVAL', new_status: 'PENDING_APPROVAL (Lvl 4)', notes: 'Nominal Rp 38.500.000 melebihi limit wewenang Supervisor (Max Rp 5.000.000). Dokumen dieskalasikan otomatis ke Level 4.' },
    { id: 4, timestamp: '2026-10-14T16:00:00Z', document_type: 'PR', document_number: 'PR-202610-001', actor_name: 'Siti Rahma', actor_role: 'KEPALA_BAGIAN (L4)', action: 'ESCALATE_PR', previous_status: 'PENDING_APPROVAL (Lvl 4)', new_status: 'PENDING_APPROVAL (Lvl 5)', notes: 'Nominal Rp 38.500.000 melebihi limit wewenang Kabag (Max Rp 20.000.000). Dokumen dieskalasikan otomatis ke Level 5.' },
    { id: 5, timestamp: '2026-10-15T09:00:00Z', document_type: 'PR', document_number: 'PR-202610-001', actor_name: 'Hendra Wijaya', actor_role: 'ASISTEN_MANAGER (L5)', action: 'ESCALATE_PR', previous_status: 'PENDING_APPROVAL (Lvl 5)', new_status: 'PENDING_APPROVAL (Lvl 6)', notes: 'Nominal Rp 38.500.000 dieskalasikan ke Manager (Level 6) untuk verifikasi anggaran divisi.' },
    { id: 6, timestamp: '2026-10-15T10:30:00Z', document_type: 'PR', document_number: 'PR-202610-001', actor_name: 'Ir. Bambang Hartono', actor_role: 'MANAGER (L6)', action: 'APPROVE_PR_FINAL', previous_status: 'PENDING_APPROVAL (Lvl 6)', new_status: 'APPROVED', notes: 'Disetujui secara final. Nominal masih dalam limit Manager (Max Rp 250.000.000). Diteruskan ke Purchasing.' },
    { id: 7, timestamp: '2026-10-15T13:00:00Z', document_type: 'PO', document_number: 'PO-202610-001', actor_name: 'Maya Sartika', actor_role: 'PURCHASING', action: 'CREATE_DRAFT_PO', previous_status: '-', new_status: 'DRAFT_PO', notes: 'Draft PO dibuat dari PR-202610-001 dengan vendor rekanan PT Surya Abadi Digital.' },
    { id: 8, timestamp: '2026-10-15T14:20:00Z', document_type: 'PO', document_number: 'PO-202610-001', actor_name: 'Ir. Bambang Hartono', actor_role: 'MANAGER (L6)', action: 'APPROVE_PO', previous_status: 'WAITING_PO_APPROVAL', new_status: 'APPROVED', notes: 'Otorisasi PO disetujui oleh Manager (memenuhi syarat minimal Level 6).' },
    { id: 9, timestamp: '2026-10-15T15:00:00Z', document_type: 'PO', document_number: 'PO-202610-001', actor_name: 'Maya Sartika', actor_role: 'PURCHASING', action: 'RELEASE_PO_TO_VENDOR', previous_status: 'APPROVED', new_status: 'RELEASED_TO_VENDOR', notes: 'PO resmi diterbitkan ke Vendor. Sistem otomatis menerbitkan tiket penerimaan barang GR-202610-001 ke antrean Gudang.' }
  ]
};

function seedDatabase() {
  fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf-8');
  console.log(`[Database] Initial database seeded successfully at: ${dbPath}`);
}

if (!fs.existsSync(dbPath)) {
  seedDatabase();
}

module.exports = {
  dbPath,
  seedDatabase,
  initialData
};

-- ============================================================================
-- GOODS REQUEST SYSTEM (APLIKASI PERMOHONAN BARANG) - DATABASE SCHEMA
-- Compatible with PostgreSQL 13+ / MySQL 8+
-- ============================================================================

-- 1. MASTER DATA: DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. MASTER DATA: ROLES & RBAC
-- Role Levels:
-- 0: SYST000 (Admin Sistem / Superadmin)
-- 1: Petugas (Requestor)
-- 2: Gudang (Inventory Verifier)
-- 3: Supervisor (PR Approver Level 1)
-- 4: Kepala Bagian (PR Approver Level 2)
-- 5: Asisten Manager (PR Approver Level 3)
-- 6: Manager (PR & PO Approver Level 4)
-- 7: Direktur (PR & PO Approver Level 5)
-- 8: Direktur Utama (PR & PO Approver Level 6)
-- 9: Purchasing (PO Creator)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_code VARCHAR(30) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    level INT NOT NULL UNIQUE, -- Hierarchy level for dynamic threshold checking
    can_approve_pr BOOLEAN DEFAULT FALSE,
    can_approve_po BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role_id INT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
    department_id INT REFERENCES departments(id) ON UPDATE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. MASTER APPROVAL LIMITS (Dynamic PR Threshold for Role Level 3 to 8)
CREATE TABLE IF NOT EXISTS approval_limits (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
    min_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    max_amount NUMERIC(15, 2) NOT NULL, -- Maximum nominal amount this role can approve
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_positive_limits CHECK (min_amount >= 0 AND max_amount > min_amount)
);

-- 5. VENDORS / SUPPLIERS (For PO Phase)
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    vendor_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    email VARCHAR(100),
    tax_id VARCHAR(50), -- NPWP
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. PURCHASE REQUESTS (PR / Permohonan Barang)
-- Status lifecycle: 
-- DRAFT -> SUBMITTED -> IN_STOCK_CHECK -> STOCK_FULFILLED / PENDING_APPROVAL -> APPROVED / REJECTED -> CLOSED
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    pr_number VARCHAR(50) NOT NULL UNIQUE,
    requestor_id INT NOT NULL REFERENCES users(id),
    department_id INT NOT NULL REFERENCES departments(id),
    request_date DATE NOT NULL,
    purpose TEXT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    total_estimated_amount NUMERIC(15, 2) DEFAULT 0.00,
    current_approval_level INT DEFAULT NULL, -- Next required role level (3, 4, 5, 6, 7, 8)
    final_approver_id INT REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. REQUEST ITEMS (Item Permohonan)
CREATE TABLE IF NOT EXISTS request_items (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    item_name VARCHAR(200) NOT NULL,
    specification TEXT,
    qty_requested NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    estimated_unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_estimated_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Stock verification columns populated by Gudang
    warehouse_stock_qty NUMERIC(10, 2) DEFAULT 0.00,
    qty_to_buy NUMERIC(10, 2) DEFAULT 0.00,
    warehouse_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. PURCHASE ORDERS (PO - Dibuat oleh Purchasing dari PR yang Approved)
-- Status lifecycle:
-- DRAFT_PO -> PENDING_APPROVAL -> APPROVED -> REJECTED -> RELEASED_TO_VENDOR -> COMPLETED / CANCELLED
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    request_id INT NOT NULL REFERENCES requests(id) ON UPDATE CASCADE,
    purchasing_user_id INT NOT NULL REFERENCES users(id),
    vendor_id INT NOT NULL REFERENCES vendors(id),
    po_date DATE NOT NULL,
    delivery_date DATE,
    payment_terms VARCHAR(100),
    
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) DEFAULT 11.00, -- Default PPN 11%
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT_PO',
    
    -- PO Approval attributes (Constraint: Must be role level >= 6)
    approved_by_user_id INT REFERENCES users(id),
    approved_at TIMESTAMP,
    po_approval_notes TEXT,
    
    released_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. PURCHASE ORDER ITEMS
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    po_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    request_item_id INT REFERENCES request_items(id),
    item_name VARCHAR(200) NOT NULL,
    specification TEXT,
    qty NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. GOODS RECEIPTS (Penerimaan Barang oleh Gudang setelah PO Terbit)
-- Ketika PO di-release ke vendor, sistem secara otomatis menerbitkan tiket penerimaan barang untuk Gudang.
-- Status lifecycle:
-- WAITING_RECEIPT -> PARTIALLY_RECEIVED -> RECEIVED_COMPLETED -> CANCELLED
CREATE TABLE IF NOT EXISTS goods_receipts (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    po_id INT NOT NULL REFERENCES purchase_orders(id) ON UPDATE CASCADE,
    warehouse_user_id INT REFERENCES users(id), -- Gudang yang memproses/menerima barang
    vendor_delivery_note_number VARCHAR(100), -- Nomor Surat Jalan / DO dari Vendor
    received_date TIMESTAMP,
    status VARCHAR(40) NOT NULL DEFAULT 'WAITING_RECEIPT',
    receiving_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. GOODS RECEIPT ITEMS
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id SERIAL PRIMARY KEY,
    goods_receipt_id INT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_item_id INT NOT NULL REFERENCES purchase_order_items(id),
    qty_ordered NUMERIC(10, 2) NOT NULL,
    qty_received NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    qty_accepted NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- Kuantitas lolos QC
    qty_rejected NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- Kuantitas cacat/retur
    warehouse_bin_location VARCHAR(50), -- Lokasi rak/bin penyimpanan di gudang
    item_condition_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. AUDIT TRAIL / APPROVAL LOGS (Lengkap untuk kepatuhan & transparansi)
CREATE TABLE IF NOT EXISTS approval_logs (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(20) NOT NULL, -- 'PR', 'PO', or 'GOODS_RECEIPT'
    document_id INT NOT NULL,
    actor_id INT NOT NULL REFERENCES users(id),
    role_id INT NOT NULL REFERENCES roles(id),
    action VARCHAR(50) NOT NULL, -- 'SUBMITTED', 'VERIFIED_STOCK', 'APPROVED', 'REJECTED', 'ESCALATED', 'PO_CREATED', 'PO_RELEASED', 'GOODS_RECEIVED'
    previous_status VARCHAR(40),
    new_status VARCHAR(40),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA: INITIAL ROLES AND SYSTEM CONFIGURATION
-- ============================================================================
INSERT INTO roles (role_code, role_name, level, can_approve_pr, can_approve_po, description) VALUES
('SYST000', 'Admin Sistem / Superadmin', 0, FALSE, FALSE, 'Pengatur master data, konfigurasi limit, dan manajemen user'),
('REQUESTOR', 'Petugas (Requestor)', 1, FALSE, FALSE, 'Pembuat form permohonan PR'),
('GUDANG', 'Gudang (Inventory Verifier)', 2, FALSE, FALSE, 'Pengecek ketersediaan stok awal gudang'),
('SUPERVISOR', 'Supervisor', 3, TRUE, FALSE, 'PR Approver Level 1'),
('KEPALA_BAGIAN', 'Kepala Bagian', 4, TRUE, FALSE, 'PR Approver Level 2'),
('ASISTEN_MANAGER', 'Asisten Manager', 5, TRUE, FALSE, 'PR Approver Level 3'),
('MANAGER', 'Manager', 6, TRUE, TRUE, 'PR & PO Approver Level 4 (Minimal PO Approver)'),
('DIREKTUR', 'Direktur', 7, TRUE, TRUE, 'PR & PO Approver Level 5'),
('DIREKTUR_UTAMA', 'Direktur Utama', 8, TRUE, TRUE, 'PR & PO Approver Level 6'),
('PURCHASING', 'Purchasing', 9, FALSE, FALSE, 'PO Creator dari PR yang approved');

-- Seed approval limits for role levels 3 to 8
INSERT INTO approval_limits (role_id, min_amount, max_amount)
SELECT id, 0.00, 5000000.00 FROM roles WHERE role_code = 'SUPERVISOR';
INSERT INTO approval_limits (role_id, min_amount, max_amount)
SELECT id, 5000000.01, 20000000.00 FROM roles WHERE role_code = 'KEPALA_BAGIAN';
INSERT INTO approval_limits (role_id, min_amount, max_amount)
SELECT id, 20000000.01, 50000000.00 FROM roles WHERE role_code = 'ASISTEN_MANAGER';
INSERT INTO approval_limits (role_id, min_amount, max_amount)
SELECT id, 50000000.01, 250000000.00 FROM roles WHERE role_code = 'MANAGER';
INSERT INTO approval_limits (role_id, min_amount, max_amount)
SELECT id, 250000000.01, 1000000000.00 FROM roles WHERE role_code = 'DIREKTUR';
INSERT INTO approval_limits (role_id, min_amount, max_amount)
SELECT id, 1000000000.01, 999999999999.00 FROM roles WHERE role_code = 'DIREKTUR_UTAMA';

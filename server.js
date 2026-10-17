const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { dbPath, initialData, seedDatabase } = require('./data/seed');

const app = express();
const PORT = process.env.PORT || 3300;
const JWT_SECRET = process.env.JWT_SECRET || 'flowrequest-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

app.use(cors());
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Format data JSON tidak valid.' });
  }
  next(err);
});
app.use(express.static(path.join(__dirname, 'public')));


// Helper to read / write DB
function getDB() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    seedDatabase();
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Active user session simulation (null = not logged in / shows login page)
let currentUserId = null;

function getActiveUser(db, req = null) {
  let targetId = null;

  // 1. Ekstrak User ID dari JWT Token (Stateless Authentication)
  if (req && req.user && req.user.id) {
    targetId = req.user.id;
  } else if (req && req.headers && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.substring(7));
      if (decoded && decoded.id) targetId = decoded.id;
    }
  } else if (currentUserId) {
    // 2. Fallback jika ada session legacy
    targetId = currentUserId;
  }

  if (!targetId) return null;
  const user = db.users.find(u => u.id === targetId);
  if (!user) return null;
  const role = db.roles.find(r => r.id === user.role_id) || {};
  const limit = db.approval_limits.find(l => l.level === user.role_level) || null;
  return {
    ...user,
    role_name: role.role_name || user.role_name,
    role_level: role.level !== undefined ? role.level : user.role_level,
    can_approve_pr: !!role.can_approve_pr,
    can_approve_po: !!role.can_approve_po,
    limit
  };
}


// Log audit helper
function addAuditLog(db, { docType, docNumber, actor, action, prevStatus, newStatus, notes }) {
  const actorName = actor ? actor.full_name : 'System';
  const actorRole = actor ? (actor.role_name + (actor.role_level ? ` (L${actor.role_level})` : '')) : 'SYSTEM';
  const newLog = {
    id: (db.approval_logs.length ? Math.max(...db.approval_logs.map(l => l.id)) : 0) + 1,
    timestamp: new Date().toISOString(),
    document_type: docType,
    document_number: docNumber,
    actor_name: actorName,
    actor_role: actorRole,
    action,
    previous_status: prevStatus,
    new_status: newStatus,
    notes: notes || '-'
  };
  db.approval_logs.unshift(newLog);
}

// ============================================================================
// JWT TOKEN HELPERS & MIDDLEWARE
// ============================================================================

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id,
      role_code: user.role_code,
      role_level: user.role_level,
      role_name: user.role_name,
      department_id: user.department_id,
      department_name: user.department_name,
      can_approve_pr: !!user.can_approve_pr,
      can_approve_po: !!user.can_approve_po
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Middleware: Authenticate via Bearer Token or Session
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token JWT tidak valid atau telah kedaluwarsa.' });
    }
    req.user = decoded;
    return next();
  }

  // Fallback to active desktop session
  const db = getDB();
  const sessionUser = getActiveUser(db);
  if (sessionUser) {
    req.user = sessionUser;
    return next();
  }

  return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan sertakan Bearer Token di header Authorization.' });
}

// ============================================================================
// AUTH & CURRENT SESSION ROUTES
// ============================================================================

// GET /api/auth/current - Returns current session or decoded token user
app.get('/api/auth/current', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      const db = getDB();
      const user = db.users.find(u => u.id === decoded.id);
      if (user && user.is_active) {
        const role = db.roles.find(r => r.id === user.role_id) || {};
        const limit = db.approval_limits.find(l => l.level === user.role_level) || null;
        return res.json({
          success: true,
          data: {
            ...user,
            role_name: role.role_name || user.role_name,
            role_level: role.level !== undefined ? role.level : user.role_level,
            can_approve_pr: !!role.can_approve_pr,
            can_approve_po: !!role.can_approve_po,
            limit
          }
        });
      }
    }
  }

  const db = getDB();
  const user = getActiveUser(db);
  res.json({ success: true, data: user });
});

// GET /api/auth/me - Direct JWT token profile inspection
app.get('/api/auth/me', authenticateUser, (req, res) => {
  res.json({
    success: true,
    message: 'User profile retrieved successfully.',
    data: req.user
  });
});

// POST /api/auth/verify - Validate token from body or header
app.post('/api/auth/verify', (req, res) => {
  const token = req.body.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token JWT wajib disertakan.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, valid: false, message: 'Token tidak valid atau kedaluwarsa.' });
  }

  return res.json({
    success: true,
    valid: true,
    message: 'Token JWT valid.',
    data: decoded
  });
});

// POST /api/auth/login - Main Login Endpoint with JWT Token Generation
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDB();

  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, message: 'Username atau email wajib diisi.' });
  }

  const cleanU = username.trim().toLowerCase();
  const user = db.users.find(u => u.username.toLowerCase() === cleanU || u.email.toLowerCase() === cleanU);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Akun dengan username atau email tersebut tidak ditemukan.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Akun ini telah dinonaktifkan oleh administrator.' });
  }

  // Password validation: accepts 'password123', 'admin123', username, or matching custom password
  if (password && password !== 'password123' && password !== 'admin123' && password !== user.username) {
    return res.status(401).json({ success: false, message: 'Password salah. Gunakan password "password123" atau username Anda.' });
  }

  // Stateless Authentication: Server TIDAK LAGI mengisi currentUserId, melainkan menerbitkan Token JWT
  const role = db.roles.find(r => r.id === user.role_id) || {};
  const limit = db.approval_limits.find(l => l.level === user.role_level) || null;
  const activeUser = {
    ...user,
    role_name: role.role_name || user.role_name,
    role_level: role.level !== undefined ? role.level : user.role_level,
    can_approve_pr: !!role.can_approve_pr,
    can_approve_po: !!role.can_approve_po,
    limit
  };

  // Generate JWT Signed Token berbasis payload User
  const token = generateToken(activeUser);


  addAuditLog(db, {
    docType: 'AUTH',
    docNumber: `AUTH-${user.id}`,
    actor: activeUser,
    action: 'USER_LOGIN',
    prevStatus: '-',
    newStatus: 'LOGGED_IN',
    notes: `Pengguna ${activeUser.full_name} (${activeUser.role_name}) berhasil login ke sistem dengan JWT Token.`
  });
  saveDB(db);

  res.json({
    success: true,
    message: `Selamat datang kembali, ${activeUser.full_name}!`,
    token,
    token_type: 'Bearer',
    expires_in: JWT_EXPIRES_IN,
    data: activeUser
  });
});


app.post('/api/auth/logout', (req, res) => {
  const db = getDB();
  const user = getActiveUser(db);
  if (user) {
    addAuditLog(db, {
      docType: 'AUTH',
      docNumber: `AUTH-${user.id}`,
      actor: user,
      action: 'USER_LOGOUT',
      prevStatus: 'LOGGED_IN',
      newStatus: 'LOGGED_OUT',
      notes: `Pengguna ${user.full_name} keluar dari sistem.`
    });
    saveDB(db);
  }
  currentUserId = null;
  res.json({ success: true, message: 'Berhasil keluar dari sistem.' });
});

app.post('/api/auth/switch-role', (req, res) => {
  const { userId, roleLevel } = req.body;
  const db = getDB();

  let targetUser = null;
  if (userId) {
    targetUser = db.users.find(u => u.id === Number(userId));
  } else if (roleLevel !== undefined) {
    targetUser = db.users.find(u => u.role_level === Number(roleLevel));
  }

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User peran tidak ditemukan.' });
  }

  currentUserId = targetUser.id;
  const activeUser = getActiveUser(db);
  res.json({ success: true, message: `Berhasil beralih peran ke: ${activeUser.full_name} (${activeUser.role_name})`, data: activeUser });
});

// ============================================================================
// METRICS & KPIS
// ============================================================================

app.get('/api/stats', (req, res) => {
  const db = getDB();
  const activeUser = getActiveUser(db);

  const totalPR = db.requests.length;
  const inWarehouse = db.requests.filter(r => r.status === 'SUBMITTED_TO_GUDANG').length;
  const pendingApproval = db.requests.filter(r => r.status === 'PENDING_APPROVAL').length;
  const approvedPR = db.requests.filter(r => r.status === 'APPROVED').length;
  const fulfilledStock = db.requests.filter(r => r.status === 'FULFILLED_BY_STOCK').length;
  const completed = db.requests.filter(r => r.status === 'COMPLETED').length;

  const myActionPR = activeUser ? db.requests.filter(r => r.status === 'PENDING_APPROVAL' && r.current_approval_level === activeUser.role_level).length : 0;
  const poWaitingApproval = db.purchase_orders.filter(po => po.status === 'WAITING_PO_APPROVAL').length;
  const waitingGoodsReceipt = db.goods_receipts.filter(gr => gr.status === 'WAITING_RECEIPT').length;

  res.json({
    success: true,
    data: {
      totalPR,
      inWarehouse,
      pendingApproval,
      approvedPR,
      fulfilledStock,
      completed,
      myActionPR,
      poWaitingApproval,
      waitingGoodsReceipt,
      activeUser
    }
  });
});

// ============================================================================
// PURCHASE REQUESTS (PR) ROUTES
// ============================================================================

app.get('/api/requests', (req, res) => {
  const db = getDB();
  const { status, view } = req.query;
  const activeUser = getActiveUser(db);

  let list = [...db.requests];

  if (view === 'my-pr') {
    list = activeUser ? list.filter(r => r.requestor_id === activeUser.id) : [];
  } else if (view === 'inbox-approver') {
    list = activeUser ? list.filter(r => r.status === 'PENDING_APPROVAL' && r.current_approval_level === activeUser.role_level) : [];
  } else if (view === 'gudang-queue') {
    list = list.filter(r => r.status === 'SUBMITTED_TO_GUDANG');
  }

  if (status && status !== 'ALL') {
    list = list.filter(r => r.status === status);
  }

  // Sort latest first
  list.sort((a, b) => b.id - a.id);
  res.json({ success: true, data: list });
});

app.get('/api/requests/:id', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const pr = db.requests.find(r => r.id === id);
  if (!pr) return res.status(404).json({ success: false, message: 'Dokumen PR tidak ditemukan.' });

  const logs = db.approval_logs.filter(l => l.document_number === pr.pr_number || (l.document_type === 'PR' && l.notes && l.notes.includes(pr.pr_number)));
  const linkedPO = db.purchase_orders.find(po => po.request_id === pr.id);
  const linkedGR = linkedPO ? db.goods_receipts.find(gr => gr.po_id === linkedPO.id) : null;

  res.json({
    success: true,
    data: {
      ...pr,
      logs,
      linkedPO,
      linkedGR
    }
  });
});

app.post('/api/requests', (req, res) => {
  const db = getDB();
  const activeUser = getActiveUser(db);
  const { purpose, required_date, urgency, items } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ success: false, message: 'Daftar barang permohonan tidak boleh kosong.' });
  }

  const nextId = (db.requests.length ? Math.max(...db.requests.map(r => r.id)) : 0) + 1;
  const prNumber = `PR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextId).padStart(3, '0')}`;

  let totalEstimated = 0;
  const parsedItems = items.map((it, idx) => {
    const qty = Number(it.qty_requested) || 1;
    const price = Number(it.estimated_unit_price) || 0;
    const lineTotal = qty * price;
    totalEstimated += lineTotal;
    return {
      id: idx + 1,
      item_name: it.item_name || 'Item Tanpa Nama',
      specification: it.specification || '',
      qty_requested: qty,
      unit: it.unit || 'Pcs',
      estimated_unit_price: price,
      total_estimated_price: lineTotal,
      warehouse_stock_qty: 0,
      qty_to_buy: qty,
      warehouse_notes: ''
    };
  });

  const newPR = {
    id: nextId,
    pr_number: prNumber,
    requestor_id: activeUser.id,
    requestor_name: activeUser.full_name,
    department_id: activeUser.department_id,
    department_name: activeUser.department_name,
    request_date: new Date().toISOString().slice(0, 10),
    required_date: required_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    purpose: purpose || 'Pengadaan barang kebutuhan operasional',
    urgency: urgency || 'NORMAL',
    status: 'SUBMITTED_TO_GUDANG',
    total_estimated_amount: totalEstimated,
    total_need_purchase_amount: totalEstimated,
    current_approval_level: null,
    final_approver_id: null,
    final_approver_name: null,
    approved_at: null,
    items: parsedItems
  };

  db.requests.push(newPR);

  addAuditLog(db, {
    docType: 'PR',
    docNumber: prNumber,
    actor: activeUser,
    action: 'SUBMIT_PR',
    prevStatus: 'DRAFT',
    newStatus: 'SUBMITTED_TO_GUDANG',
    notes: `Permohonan baru diajukan oleh ${activeUser.full_name}. Nilai estimasi: Rp ${totalEstimated.toLocaleString('id-ID')}`
  });

  saveDB(db);
  res.status(201).json({ success: true, message: `Permohonan ${prNumber} berhasil dikirim ke bagian Gudang.`, data: newPR });
});

// FASE 1: Verifikasi Stok oleh Gudang
app.post('/api/requests/:id/verify-stock', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { verifications } = req.body; // array of { itemId, warehouseStockQty, qtyToBuy, warehouseNotes }

  const pr = db.requests.find(r => r.id === id);
  if (!pr) return res.status(404).json({ success: false, message: 'Dokumen PR tidak ditemukan.' });

  if (pr.status !== 'SUBMITTED_TO_GUDANG') {
    return res.status(400).json({ success: false, message: 'Dokumen PR tidak dalam status verifikasi gudang.' });
  }

  let totalNeedBuyAmount = 0;
  let anyPurchaseNeeded = false;

  pr.items.forEach(item => {
    const v = (verifications || []).find(x => x.itemId === item.id);
    if (v) {
      item.warehouse_stock_qty = Number(v.warehouseStockQty) || 0;
      item.qty_to_buy = Math.max(0, item.qty_requested - item.warehouse_stock_qty);
      if (v.qtyToBuy !== undefined) item.qty_to_buy = Number(v.qtyToBuy);
      item.warehouse_notes = v.warehouseNotes || '';
    } else {
      item.qty_to_buy = Math.max(0, item.qty_requested - item.warehouse_stock_qty);
    }

    if (item.qty_to_buy > 0) {
      anyPurchaseNeeded = true;
      totalNeedBuyAmount += item.qty_to_buy * item.estimated_unit_price;
    }
  });

  pr.total_need_purchase_amount = totalNeedBuyAmount;

  if (!anyPurchaseNeeded) {
    // Selesai dipenuhi dari stok gudang
    pr.status = 'FULFILLED_BY_STOCK';
    pr.final_approver_id = activeUser.id;
    pr.final_approver_name = `${activeUser.full_name} (Gudang)`;
    pr.approved_at = new Date().toISOString();

    addAuditLog(db, {
      docType: 'PR',
      docNumber: pr.pr_number,
      actor: activeUser,
      action: 'STOCK_FULFILLED',
      prevStatus: 'SUBMITTED_TO_GUDANG',
      newStatus: 'FULFILLED_BY_STOCK',
      notes: 'Seluruh barang tersedia di gudang. Permohonan dipenuhi langsung dari stok rak tanpa pembelian baru.'
    });

    saveDB(db);
    return res.json({
      success: true,
      message: 'Seluruh barang terpenuhi dari stok gudang. Status menjadi FULFILLED_BY_STOCK.',
      data: pr
    });
  }

  // Ada barang yang harus dibeli -> Dynamic Threshold Routing mulai dari Supervisor (Level 3)
  pr.status = 'PENDING_APPROVAL';
  pr.current_approval_level = 3;

  addAuditLog(db, {
    docType: 'PR',
    docNumber: pr.pr_number,
    actor: activeUser,
    action: 'VERIFY_STOCK_ESCALATE',
    prevStatus: 'SUBMITTED_TO_GUDANG',
    newStatus: 'PENDING_APPROVAL (L3)',
    notes: `Stok gudang tidak mencukupi (Total belanja Rp ${totalNeedBuyAmount.toLocaleString('id-ID')}). PR dialihkan ke alur persetujuan Level 3 (Supervisor).`
  });

  saveDB(db);
  res.json({
    success: true,
    message: `Pengecekan stok selesai. PR dialihkan ke alur persetujuan Supervisor (Level 3). Total belanja: Rp ${totalNeedBuyAmount.toLocaleString('id-ID')}`,
    data: pr
  });
});

// FASE 1: Dynamic Threshold PR Approval (Level 3 s/d 8)
app.post('/api/requests/:id/approve', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { notes } = req.body;

  const pr = db.requests.find(r => r.id === id);
  if (!pr) return res.status(404).json({ success: false, message: 'Dokumen PR tidak ditemukan.' });

  if (pr.status !== 'PENDING_APPROVAL') {
    return res.status(400).json({ success: false, message: 'Dokumen PR tidak sedang menunggu persetujuan.' });
  }

  const approverLevel = activeUser.role_level;
  if (approverLevel < 3 || approverLevel > 8) {
    return res.status(403).json({ success: false, message: 'Hanya peran pimpinan Level 3 s/d 8 yang berwenang menyetujui PR.' });
  }

  if (pr.current_approval_level !== approverLevel) {
    return res.status(403).json({
      success: false,
      message: `Belum giliran Anda. Dokumen sedang berada pada antrean Level ${pr.current_approval_level}, peran Anda adalah Level ${approverLevel}.`
    });
  }

  // Ambil limit threshold untuk role ini
  const limitObj = db.approval_limits.find(l => l.level === approverLevel);
  const maxLimit = limitObj ? limitObj.max_amount : (approverLevel === 8 ? Infinity : 0);
  const totalAmount = pr.total_need_purchase_amount !== undefined ? pr.total_need_purchase_amount : pr.total_estimated_amount;

  if (totalAmount <= maxLimit || approverLevel === 8) {
    // APPROVAL FINAL!
    pr.status = 'APPROVED';
    pr.current_approval_level = null;
    pr.final_approver_id = activeUser.id;
    pr.final_approver_name = `${activeUser.full_name} (${activeUser.role_name})`;
    pr.approved_at = new Date().toISOString();

    addAuditLog(db, {
      docType: 'PR',
      docNumber: pr.pr_number,
      actor: activeUser,
      action: 'APPROVE_PR_FINAL',
      prevStatus: `PENDING_APPROVAL (L${approverLevel})`,
      newStatus: 'APPROVED',
      notes: `PR disetujui secara final oleh ${activeUser.full_name}. Nilai Rp ${totalAmount.toLocaleString('id-ID')} berada dalam limit wewenang. Dokumen siap diproses Purchasing.`
    });

    saveDB(db);
    return res.json({
      success: true,
      is_final: true,
      message: `PR ${pr.pr_number} resmi DISETUJUI SECARA FINAL. Dokumen kini berada di pool Purchasing untuk pembuatan PO.`,
      data: pr
    });
  } else {
    // ESKALASI OTOMATIS KE LEVEL BERIKUTNYA (Level + 1)
    const nextLevel = approverLevel + 1;
    const nextRole = db.roles.find(r => r.level === nextLevel);
    pr.current_approval_level = nextLevel;

    addAuditLog(db, {
      docType: 'PR',
      docNumber: pr.pr_number,
      actor: activeUser,
      action: 'ESCALATE_PR',
      prevStatus: `PENDING_APPROVAL (L${approverLevel})`,
      newStatus: `PENDING_APPROVAL (L${nextLevel})`,
      notes: `Nominal Rp ${totalAmount.toLocaleString('id-ID')} melebihi limit wewenang ${activeUser.role_name} (Maks Rp ${maxLimit.toLocaleString('id-ID')}). Dokumen otomatis dieskalasi ke Level ${nextLevel} (${nextRole ? nextRole.role_name : 'Atasan'}).`
    });

    saveDB(db);
    return res.json({
      success: true,
      is_final: false,
      message: `Nominal melebihi batas Level ${approverLevel} (Maks Rp ${maxLimit.toLocaleString('id-ID')}). Dokumen berhasil dieskalasikan ke Level ${nextLevel} (${nextRole ? nextRole.role_name : 'Atasan'}).`,
      data: pr
    });
  }
});

app.post('/api/requests/:id/reject', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { reason } = req.body;

  const pr = db.requests.find(r => r.id === id);
  if (!pr) return res.status(404).json({ success: false, message: 'Dokumen PR tidak ditemukan.' });

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan wajib dicantumkan.' });
  }

  const prev = pr.status;
  pr.status = 'REJECTED';
  pr.current_approval_level = null;
  pr.rejection_reason = reason;

  addAuditLog(db, {
    docType: 'PR',
    docNumber: pr.pr_number,
    actor: activeUser,
    action: 'REJECT_PR',
    prevStatus: prev,
    newStatus: 'REJECTED',
    notes: `Permohonan ditolak oleh ${activeUser.full_name}: "${reason}"`
  });

  saveDB(db);
  res.json({ success: true, message: `Permohonan ${pr.pr_number} telah DITOLAK.`, data: pr });
});

// ============================================================================
// PURCHASE ORDER (PO) ROUTES
// ============================================================================

app.get('/api/purchase-orders', (req, res) => {
  const db = getDB();
  const list = [...db.purchase_orders].sort((a, b) => b.id - a.id);
  res.json({ success: true, data: list });
});

app.post('/api/purchase-orders', (req, res) => {
  const db = getDB();
  const activeUser = getActiveUser(db);
  const { request_id, vendor_id, delivery_date, payment_terms, tax_rate, items } = req.body;

  // Validasi: Harus peran Purchasing (Level 9) atau SYST000
  if (activeUser.role_code !== 'PURCHASING' && activeUser.role_level !== 0) {
    return res.status(403).json({ success: false, message: 'Hanya peran Purchasing yang berhak membuat Purchase Order.' });
  }

  const pr = db.requests.find(r => r.id === Number(request_id));
  if (!pr) return res.status(404).json({ success: false, message: 'PR sumber tidak ditemukan.' });
  if (pr.status !== 'APPROVED') {
    return res.status(400).json({ success: false, message: 'Hanya PR yang berstatus APPROVED yang dapat dibuatkan PO.' });
  }

  const vendor = db.vendors.find(v => v.id === Number(vendor_id)) || db.vendors[0];

  const nextId = (db.purchase_orders.length ? Math.max(...db.purchase_orders.map(p => p.id)) : 0) + 1;
  const poNumber = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextId).padStart(3, '0')}`;

  let subtotal = 0;
  const poItems = (items || pr.items.filter(i => i.qty_to_buy > 0)).map((it, idx) => {
    const qty = Number(it.qty) || Number(it.qty_to_buy) || 1;
    const price = Number(it.unit_price) || Number(it.estimated_unit_price) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    return {
      id: idx + 1,
      request_item_id: it.request_item_id || it.id,
      item_name: it.item_name,
      specification: it.specification || '',
      qty,
      unit: it.unit || 'Unit',
      unit_price: price,
      total_price: lineTotal
    };
  });

  const tax = Number(tax_rate) !== undefined ? Number(tax_rate) : 11;
  const taxAmount = (subtotal * tax) / 100;
  const grandTotal = subtotal + taxAmount;

  const newPO = {
    id: nextId,
    po_number: poNumber,
    request_id: pr.id,
    pr_number: pr.pr_number,
    purchasing_user_id: activeUser.id,
    purchasing_user_name: activeUser.full_name,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_phone: vendor.phone,
    vendor_address: vendor.address,
    po_date: new Date().toISOString().slice(0, 10),
    delivery_date: delivery_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    payment_terms: payment_terms || vendor.payment_terms || 'Net 30 Days',
    subtotal,
    tax_rate: tax,
    tax_amount: taxAmount,
    grand_total: grandTotal,
    status: 'WAITING_PO_APPROVAL',
    approved_by_user_id: null,
    approved_by_name: null,
    approved_at: null,
    po_approval_notes: null,
    released_at: null,
    items: poItems
  };

  pr.status = 'IN_PO_PROCESS';
  db.purchase_orders.push(newPO);

  addAuditLog(db, {
    docType: 'PO',
    docNumber: poNumber,
    actor: activeUser,
    action: 'CREATE_DRAFT_PO',
    prevStatus: 'PR APPROVED',
    newStatus: 'WAITING_PO_APPROVAL',
    notes: `Draft PO dibuat untuk vendor ${vendor.name}. Total: Rp ${grandTotal.toLocaleString('id-ID')} (termasuk PPN ${tax}%). Menunggu otorisasi Manager (Level 6+).`
  });

  saveDB(db);
  res.status(201).json({ success: true, message: `PO ${poNumber} berhasil dibentuk dan diajukan untuk otorisasi Manajemen.`, data: newPO });
});

// FASE 2: PO Approval (STRICT SECURITY RULE: Level >= 6)
app.post('/api/purchase-orders/:id/approve', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { notes } = req.body;

  const po = db.purchase_orders.find(p => p.id === id);
  if (!po) return res.status(404).json({ success: false, message: 'Dokumen PO tidak ditemukan.' });

  // HARD ENFORCEMENT: Approver PO wajib Level >= 6
  if (activeUser.role_level < 6) {
    return res.status(403).json({
      success: false,
      message: `Pelanggaran Otoritas: Otorisasi PO memerlukan jabatan minimal Manager (Level 6 ke atas). Peran Anda saat ini adalah ${activeUser.role_name} (Level ${activeUser.role_level}).`
    });
  }

  if (po.status !== 'WAITING_PO_APPROVAL' && po.status !== 'DRAFT_PO') {
    return res.status(400).json({ success: false, message: 'Status PO tidak dalam posisi menunggu persetujuan.' });
  }

  po.status = 'APPROVED';
  po.approved_by_user_id = activeUser.id;
  po.approved_by_name = `${activeUser.full_name} (${activeUser.role_name})`;
  po.approved_at = new Date().toISOString();
  po.po_approval_notes = notes || 'Disetujui untuk diterbitkan ke vendor.';

  addAuditLog(db, {
    docType: 'PO',
    docNumber: po.po_number,
    actor: activeUser,
    action: 'APPROVE_PO',
    prevStatus: 'WAITING_PO_APPROVAL',
    newStatus: 'APPROVED',
    notes: `PO disetujui oleh ${activeUser.full_name} (${activeUser.role_name} Level ${activeUser.role_level}). Catatan: ${po.po_approval_notes}`
  });

  saveDB(db);
  res.json({
    success: true,
    message: `PO ${po.po_number} BERHASIL DISETUJUI oleh ${activeUser.full_name}. Dokumen siap dirilis ke vendor oleh Purchasing.`,
    data: po
  });
});

app.post('/api/purchase-orders/:id/reject', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { reason } = req.body;

  const po = db.purchase_orders.find(p => p.id === id);
  if (!po) return res.status(404).json({ success: false, message: 'Dokumen PO tidak ditemukan.' });

  if (activeUser.role_level < 6) {
    return res.status(403).json({ success: false, message: 'Penolakan PO hanya dapat dilakukan oleh Manager ke atas (Level 6+).' });
  }

  po.status = 'REJECTED';
  po.po_approval_notes = reason || 'Ditolak oleh manajemen.';

  addAuditLog(db, {
    docType: 'PO',
    docNumber: po.po_number,
    actor: activeUser,
    action: 'REJECT_PO',
    prevStatus: 'WAITING_PO_APPROVAL',
    newStatus: 'REJECTED',
    notes: `PO ditolak oleh ${activeUser.full_name}: "${reason || 'Tanpa catatan'}"`
  });

  saveDB(db);
  res.json({ success: true, message: `PO ${po.po_number} telah DITOLAK.`, data: po });
});

// FASE 2: Release PO ke Vendor -> AUTO TRIGGER GOODS RECEIPT TIKET KE GUDANG!
app.post('/api/purchase-orders/:id/release', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);

  if (activeUser.role_code !== 'PURCHASING' && activeUser.role_level !== 0) {
    return res.status(403).json({ success: false, message: 'Hanya peran Purchasing yang berwenang merilis PO ke Vendor.' });
  }

  const po = db.purchase_orders.find(p => p.id === id);
  if (!po) return res.status(404).json({ success: false, message: 'Dokumen PO tidak ditemukan.' });

  if (po.status !== 'APPROVED') {
    return res.status(400).json({ success: false, message: 'PO belum disetujui oleh Manajemen. Tidak dapat diterbitkan ke vendor.' });
  }

  po.status = 'RELEASED_TO_VENDOR';
  po.released_at = new Date().toISOString();

  // OTOMATIS GENERATE TIKET PENERIMAAN BARANG (GOODS RECEIPT) KE USER GUDANG:
  const nextGRId = (db.goods_receipts.length ? Math.max(...db.goods_receipts.map(g => g.id)) : 0) + 1;
  const grNumber = `GR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextGRId).padStart(3, '0')}`;

  const grItems = po.items.map((pi, idx) => ({
    id: idx + 1,
    goods_receipt_id: nextGRId,
    po_item_id: pi.id,
    item_name: pi.item_name,
    qty_ordered: pi.qty,
    qty_received: 0,
    qty_accepted: 0,
    qty_rejected: 0,
    warehouse_bin_location: `RACK-${String.fromCharCode(65 + (idx % 6))}-01`,
    item_condition_notes: ''
  }));

  const newGR = {
    id: nextGRId,
    receipt_number: grNumber,
    po_id: po.id,
    po_number: po.po_number,
    vendor_name: po.vendor_name,
    warehouse_user_id: null,
    warehouse_user_name: null,
    vendor_delivery_note_number: null,
    received_date: null,
    status: 'WAITING_RECEIPT',
    receiving_notes: `Menunggu kedatangan fisik barang dari vendor ${po.vendor_name} sesuai pesanan ${po.po_number}.`,
    created_at: new Date().toISOString(),
    items: grItems
  };

  db.goods_receipts.push(newGR);

  addAuditLog(db, {
    docType: 'PO',
    docNumber: po.po_number,
    actor: activeUser,
    action: 'RELEASE_PO_AND_AUTO_GENERATE_GR',
    prevStatus: 'APPROVED',
    newStatus: 'RELEASED_TO_VENDOR',
    notes: `PO diterbitkan ke vendor ${po.vendor_name}. Tiket penerimaan barang ${grNumber} OTOMATIS diterbitkan ke dashboard staf Gudang.`
  });

  saveDB(db);
  res.json({
    success: true,
    message: `PO ${po.po_number} resmi dirilis ke Vendor! Tiket penerimaan ${grNumber} otomatis masuk ke antrean Gudang.`,
    data: {
      po,
      goods_receipt: newGR
    }
  });
});

// ============================================================================
// GOODS RECEIPT (PENERIMAAN BARANG GUDANG) ROUTES
// ============================================================================

app.get('/api/goods-receipts', (req, res) => {
  const db = getDB();
  const list = [...db.goods_receipts].sort((a, b) => b.id - a.id);
  res.json({ success: true, data: list });
});

app.post('/api/goods-receipts/:id/receive', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { vendor_delivery_note_number, receiving_notes, items } = req.body;

  if (activeUser.role_code !== 'GUDANG' && activeUser.role_level !== 0) {
    return res.status(403).json({ success: false, message: 'Hanya petugas Gudang yang berwenang memvalidasi penerimaan fisik barang.' });
  }

  const gr = db.goods_receipts.find(g => g.id === id);
  if (!gr) return res.status(404).json({ success: false, message: 'Tiket penerimaan barang tidak ditemukan.' });

  if (!vendor_delivery_note_number || !vendor_delivery_note_number.trim()) {
    return res.status(400).json({ success: false, message: 'Nomor Surat Jalan / Delivery Order Vendor wajib diisi.' });
  }

  let isAllComplete = true;

  (items || []).forEach(inItem => {
    const targetItem = gr.items.find(i => i.id === inItem.id || i.po_item_id === inItem.po_item_id);
    if (targetItem) {
      targetItem.qty_received = Number(inItem.qty_received) || 0;
      targetItem.qty_accepted = Number(inItem.qty_accepted) || 0;
      targetItem.qty_rejected = Number(inItem.qty_rejected) || 0;
      targetItem.warehouse_bin_location = inItem.warehouse_bin_location || targetItem.warehouse_bin_location || 'RACK-A-01';
      targetItem.item_condition_notes = inItem.item_condition_notes || 'Kondisi barang baik & segel utuh';

      if (targetItem.qty_accepted < targetItem.qty_ordered) {
        isAllComplete = false;
      }
    }
  });

  const finalStatus = isAllComplete ? 'RECEIVED_COMPLETED' : 'PARTIALLY_RECEIVED';

  gr.vendor_delivery_note_number = vendor_delivery_note_number;
  gr.warehouse_user_id = activeUser.id;
  gr.warehouse_user_name = activeUser.full_name;
  gr.received_date = new Date().toISOString();
  gr.status = finalStatus;
  gr.receiving_notes = receiving_notes || 'Pemeriksaan fisik barang & verifikasi DO selesai.';

  // Jika barang diterima lengkap, tutup siklus PO dan PR menjadi COMPLETED
  if (finalStatus === 'RECEIVED_COMPLETED') {
    const po = db.purchase_orders.find(p => p.id === gr.po_id);
    if (po) {
      po.status = 'COMPLETED';
      const pr = db.requests.find(r => r.id === po.request_id);
      if (pr) pr.status = 'COMPLETED';
    }
  }

  addAuditLog(db, {
    docType: 'GR',
    docNumber: gr.receipt_number,
    actor: activeUser,
    action: 'GOODS_RECEIVED',
    prevStatus: 'WAITING_RECEIPT',
    newStatus: finalStatus,
    notes: `Barang fisik diverifikasi oleh ${activeUser.full_name} dengan Surat Jalan vendor: ${vendor_delivery_note_number}. Status: ${finalStatus}.`
  });

  saveDB(db);
  res.json({
    success: true,
    message: isAllComplete
      ? `Seluruh barang berhasil diterima lengkap dan disimpan ke rak gudang. Siklus pengadaan SELESAI.`
      : `Penerimaan parsial dicatat. Menunggu sisa pengiriman dari vendor.`,
    data: gr
  });
});

// ============================================================================
// ADMIN SYST000 ROUTES (LIMITS & USER MANAGEMENT)
// ============================================================================

app.get('/api/approval-limits', (req, res) => {
  const db = getDB();
  res.json({ success: true, data: db.approval_limits });
});

app.put('/api/approval-limits/:id', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);
  const { min_amount, max_amount } = req.body;

  if (activeUser.role_code !== 'SYST000' && activeUser.role_level !== 0) {
    return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Admin SYST000 yang dapat mengubah threshold approval.' });
  }

  const limit = db.approval_limits.find(l => l.id === id);
  if (!limit) return res.status(404).json({ success: false, message: 'Batas approval tidak ditemukan.' });

  const min = Number(min_amount);
  const max = Number(max_amount);

  if (isNaN(min) || isNaN(max) || min < 0 || max <= min) {
    return res.status(400).json({ success: false, message: 'Nominal limit tidak valid. Pastikan min >= 0 dan max > min.' });
  }

  const oldMax = limit.max_amount;
  limit.min_amount = min;
  limit.max_amount = max;
  limit.updated_by_name = activeUser.full_name;

  addAuditLog(db, {
    docType: 'CONFIG',
    docNumber: `LIMIT-L${limit.level}`,
    actor: activeUser,
    action: 'UPDATE_THRESHOLD_LIMIT',
    prevStatus: `Max Rp ${oldMax.toLocaleString('id-ID')}`,
    newStatus: `Max Rp ${max.toLocaleString('id-ID')}`,
    notes: `Admin memperbarui batas persetujuan untuk ${limit.role_name} (Level ${limit.level}) menjadi Rp ${min.toLocaleString('id-ID')} s/d Rp ${max.toLocaleString('id-ID')}.`
  });

  saveDB(db);
  res.json({ success: true, message: `Batas nominal approval ${limit.role_name} berhasil diperbarui.`, data: limit });
});

app.get('/api/users', (req, res) => {
  const db = getDB();
  res.json({ success: true, data: db.users, roles: db.roles, departments: db.departments });
});

app.post('/api/users', (req, res) => {
  const db = getDB();
  const activeUser = getActiveUser(db);
  const { username, full_name, email, role_id, department_id } = req.body;

  if (activeUser.role_code !== 'SYST000' && activeUser.role_level !== 0) {
    return res.status(403).json({ success: false, message: 'Hanya Admin SYST000 yang berwenang menambah user.' });
  }

  if (!username || !full_name || !role_id) {
    return res.status(400).json({ success: false, message: 'Username, Nama Lengkap, dan Role wajib diisi.' });
  }

  const role = db.roles.find(r => r.id === Number(role_id)) || db.roles[1];
  const dept = db.departments.find(d => d.id === Number(department_id)) || db.departments[0];

  const nextId = (db.users.length ? Math.max(...db.users.map(u => u.id)) : 0) + 1;
  const newUser = {
    id: nextId,
    username: username.toLowerCase().trim(),
    email: email || `${username}@flowrequest.local`,
    full_name,
    role_id: role.id,
    role_code: role.role_code,
    role_level: role.level,
    role_name: role.role_name,
    department_id: dept.id,
    department_name: dept.name,
    is_active: true
  };

  db.users.push(newUser);

  addAuditLog(db, {
    docType: 'USER',
    docNumber: `USR-${nextId}`,
    actor: activeUser,
    action: 'CREATE_USER',
    prevStatus: '-',
    newStatus: 'ACTIVE',
    notes: `User baru '${full_name}' didaftarkan sebagai ${role.role_name}.`
  });

  saveDB(db);
  res.status(201).json({ success: true, message: `User ${full_name} berhasil ditambahkan.`, data: newUser });
});

app.put('/api/users/:id/toggle-status', (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const activeUser = getActiveUser(db);

  if (activeUser.role_code !== 'SYST000' && activeUser.role_level !== 0) {
    return res.status(403).json({ success: false, message: 'Hanya Admin SYST000 yang berwenang mengubah status user.' });
  }

  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  if (user.role_code === 'SYST000' && user.id === 1) {
    return res.status(400).json({ success: false, message: 'Akun Superadmin utama tidak dapat dinonaktifkan.' });
  }

  user.is_active = !user.is_active;

  addAuditLog(db, {
    docType: 'USER',
    docNumber: `USR-${user.id}`,
    actor: activeUser,
    action: user.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    prevStatus: user.is_active ? 'INACTIVE' : 'ACTIVE',
    newStatus: user.is_active ? 'ACTIVE' : 'INACTIVE',
    notes: `Status akun user ${user.full_name} diubah menjadi ${user.is_active ? 'Aktif' : 'Non-aktif'}.`
  });

  saveDB(db);
  res.json({ success: true, message: `Status akun ${user.full_name} diubah menjadi ${user.is_active ? 'Aktif' : 'Non-aktif'}.`, data: user });
});

// ============================================================================
// AUDIT LOGS & VENDORS
// ============================================================================

app.get('/api/audit-logs', (req, res) => {
  const db = getDB();
  res.json({ success: true, data: db.approval_logs });
});

app.get('/api/vendors', (req, res) => {
  const db = getDB();
  res.json({ success: true, data: db.vendors });
});

// Reset demo data
app.post('/api/reset-data', (req, res) => {
  seedDatabase();
  currentUserId = 7; // Manager
  res.json({ success: true, message: 'Seluruh database telah di-reset ke kondisi awal demo.' });
});

// Catch-all route to serve desktop single-page app
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`FlowRequest Pro - Windows Application Backend`);
  console.log(`Status  : Berjalan aktif di http://localhost:${PORT}`);
  console.log(`Mode    : Windows Desktop Application Environment`);
  console.log(`=======================================================`);
});

module.exports = { app, server };

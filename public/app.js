/**
 * FlowRequest Pro - Core Windows Desktop Application Logic
 * Integrates Two-Phase Workflow, Dynamic Threshold Routing, PO Enforcement, and Auto Goods Receiving
 */

const API_BASE = '';

// Interceptor otomatis untuk melampirkan JWT Token ke seluruh request API
const nativeFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const token = localStorage.getItem('flowrequest_jwt_token');
  if (token && typeof url === 'string' && (url.startsWith('/api') || url.includes('/api/'))) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['Authorization', `Bearer ${token}`]);
    } else {
      if (!options.headers['Authorization'] && !options.headers['authorization']) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }
  return nativeFetch(url, options).then(response => {
    // Tangani sesi kedaluwarsa secara otomatis
    if (response.status === 401 && typeof url === 'string' && !url.includes('/api/auth/login')) {
      console.warn('[JWT Auth] Sesi telah kedaluwarsa atau token tidak valid. Menghapus token lokal...');
      localStorage.removeItem('flowrequest_jwt_token');
      if (state.currentUser) {
        state.currentUser = null;
        updateCurrentUserUI();
        if (typeof showToast === 'function') {
          showToast('Sesi Berakhir', 'Sesi login telah kedaluwarsa. Silakan masuk kembali.', 'warning');
        }
      }
    }
    return response;
  });
};


// Application State

let state = {
  currentUser: null,
  activeView: 'dashboard',
  stats: {},
  requests: [],
  purchaseOrders: [],
  goodsReceipts: [],
  approvalLimits: [],
  users: [],
  roles: [],
  departments: [],
  vendors: [],
  auditLogs: [],
  selectedPR: null,
  selectedPO: null,
  selectedGR: null,
  gudangTaskFilter: 'ALL'
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[FlowRequest Pro] Windows Application Shell Loaded.');
  await loadInitialState();
  initPRFormDefaults();
  setupKeyboardShortcuts();
  setupGudangClock();
});

async function loadInitialState() {
  try {
    await fetchCurrentUser();
    if (state.currentUser) {
      await refreshAllData();
      if (state.currentUser.role_level === 2 || state.currentUser.username === 'joko_gudang') {
        switchView('gudang-dashboard');
      } else {
        renderCurrentView();
      }
    } else {
      updateCurrentUserUI();
    }
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Koneksi Gagal', 'Gagal memuat data dari backend lokal.', 'danger');
  }
}

async function fetchCurrentUser() {
  const token = localStorage.getItem('flowrequest_jwt_token');
  if (!token) {
    state.currentUser = null;
    updateCurrentUserUI();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/current`);
    if (res.status === 401) {
      localStorage.removeItem('flowrequest_jwt_token');
      state.currentUser = null;
      updateCurrentUserUI();
      return;
    }
    const json = await res.json();
    if (json.success && json.data) {
      state.currentUser = json.data;
      updateCurrentUserUI();
    } else {
      localStorage.removeItem('flowrequest_jwt_token');
      state.currentUser = null;
      updateCurrentUserUI();
    }
  } catch (err) {
    console.warn('Gagal memverifikasi token sesi aktif:', err);
  }
}


async function refreshAllData() {
  const [statsRes, prRes, poRes, grRes, limitsRes, usersRes, vendorsRes, logsRes] = await Promise.all([
    fetch(`${API_BASE}/api/stats`).then(r => r.json()),
    fetch(`${API_BASE}/api/requests`).then(r => r.json()),
    fetch(`${API_BASE}/api/purchase-orders`).then(r => r.json()),
    fetch(`${API_BASE}/api/goods-receipts`).then(r => r.json()),
    fetch(`${API_BASE}/api/approval-limits`).then(r => r.json()),
    fetch(`${API_BASE}/api/users`).then(r => r.json()),
    fetch(`${API_BASE}/api/vendors`).then(r => r.json()),
    fetch(`${API_BASE}/api/audit-logs`).then(r => r.json())
  ]);

  state.stats = statsRes.data || {};
  state.requests = prRes.data || [];
  state.purchaseOrders = poRes.data || [];
  state.goodsReceipts = grRes.data || [];
  state.approvalLimits = limitsRes.data || [];
  state.users = usersRes.data || [];
  state.roles = usersRes.roles || [];
  state.departments = usersRes.departments || [];
  state.vendors = vendorsRes.data || [];
  state.auditLogs = logsRes.data || [];

  updateBadgeCounts();
}

function updateCurrentUserUI() {
  const u = state.currentUser;
  const loginWrapper = document.getElementById('loginScreenWrapper');
  const appContainer = document.getElementById('appMainContainer');
  const titlebarUser = document.getElementById('titlebarUserInfo');

  if (!u) {
    if (loginWrapper) loginWrapper.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    if (titlebarUser) titlebarUser.style.display = 'none';
    const savedUser = localStorage.getItem('flowrequest_saved_user');
    if (savedUser && document.getElementById('loginUsername')) {
      document.getElementById('loginUsername').value = savedUser;
    }
    return;
  }

  if (loginWrapper) loginWrapper.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';
  if (titlebarUser) {
    titlebarUser.style.display = 'flex';
    const initials = u.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('titlebarUserName').textContent = `${u.full_name} (${u.role_name})`;
  }

  // Header & Switcher
  const sel = document.getElementById('activeRoleSelector');
  if (sel) sel.value = String(u.id);

  // Avatar & Names
  const initials = u.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('currentUserAvatar').textContent = initials;
  document.getElementById('currentUserName').textContent = u.full_name;
  document.getElementById('currentUserRole').textContent = `${u.role_name} (Level ${u.role_level})`;

  // Limits Display
  const limitDisplay = document.getElementById('roleLimitDisplay');
  if (u.role_level >= 3 && u.role_level <= 8) {
    const lim = state.approvalLimits.find(l => l.level === u.role_level);
    if (lim) {
      limitDisplay.textContent = u.role_level === 8 ? 'Unlimited (Tanpa Batas Atas)' : `s/d Rp ${lim.max_amount.toLocaleString('id-ID')}`;
    } else {
      limitDisplay.textContent = 'Dalam Matriks Limit';
    }
  } else if (u.role_level === 0) {
    limitDisplay.textContent = 'Superadmin Master Controller';
  } else {
    limitDisplay.textContent = 'Tidak Memiliki Otoritas PR';
  }

  // PO Eligibility Badge
  const poBadge = document.getElementById('rolePOEligibility');
  if (u.role_level >= 6 && u.role_level <= 8) {
    poBadge.className = 'badge badge-approved';
    poBadge.textContent = `Eligible (Level ${u.role_level})`;
  } else if (u.role_level === 0) {
    poBadge.className = 'badge badge-po';
    poBadge.textContent = 'Superadmin Config';
  } else {
    poBadge.className = 'badge badge-rejected';
    poBadge.textContent = 'Dilarang (Min Level 6)';
  }

  // Update PR Form Requestor defaults
  const prReq = document.getElementById('prFormRequestor');
  if (prReq) prReq.value = u.full_name;
  const prDept = document.getElementById('prFormDept');
  if (prDept) prDept.value = u.department_name || 'Teknologi Informasi';
}

// ============================================================================
// LOGIN, LOGOUT & AUTHENTICATION HANDLERS
// ============================================================================

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const rememberCheckbox = document.getElementById('loginRememberMe');
  const errBox = document.getElementById('loginErrorBox');
  const submitBtn = document.getElementById('loginSubmitBtn');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const remember = rememberCheckbox ? rememberCheckbox.checked : false;

  if (errBox) errBox.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Memverifikasi Akun...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();
    if (json.success) {
      state.currentUser = json.data;
      if (json.token) {
        localStorage.setItem('flowrequest_jwt_token', json.token);
      }
      if (remember) {
        localStorage.setItem('flowrequest_saved_user', username);
      } else {
        localStorage.removeItem('flowrequest_saved_user');
      }

      updateCurrentUserUI();
      await refreshAllData();
      if (json.data.role_level === 2 || json.data.username === 'joko_gudang') {
        switchView('gudang-dashboard');
      } else {
        renderCurrentView();
      }
      showToast('Login Berhasil', json.message, 'success');
    } else {
      if (errBox) {
        errBox.textContent = `⚠️ ${json.message}`;
        errBox.style.display = 'block';
      }
      showToast('Gagal Masuk', json.message, 'danger');
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = '⚠️ Gagal menghubungi server lokal.';
      errBox.style.display = 'block';
    }
    showToast('Error', 'Gagal memproses otentikasi.', 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Masuk ke Sistem (Sign In)</span>';
    }
  }
}

async function quickLoginAs(username, password = 'password123') {
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  if (usernameInput) usernameInput.value = username;
  if (passwordInput) passwordInput.value = password;
  await handleLoginSubmit();
}

async function executeLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari sistem?')) return;
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    state.currentUser = null;
    localStorage.removeItem('flowrequest_jwt_token');
    updateCurrentUserUI();

    const pwInput = document.getElementById('loginPassword');
    if (pwInput) pwInput.value = '';
    const errBox = document.getElementById('loginErrorBox');
    if (errBox) errBox.style.display = 'none';
    showToast('Keluar Sistem', 'Anda telah keluar dari akun.', 'info');
  } catch (err) {
    showToast('Error', 'Gagal memproses logout.', 'danger');
  }
}

function togglePasswordVisibility() {
  const pw = document.getElementById('loginPassword');
  if (!pw) return;
  pw.type = pw.type === 'password' ? 'text' : 'password';
}

function updateBadgeCounts() {
  const u = state.currentUser;
  if (!u) return;

  // Gudang queue (PR status SUBMITTED_TO_GUDANG)
  const gudangCount = state.requests.filter(r => r.status === 'SUBMITTED_TO_GUDANG').length;
  const badgeGudangQueueEl = document.getElementById('badgeGudangQueue');
  if (badgeGudangQueueEl) badgeGudangQueueEl.textContent = gudangCount;

  // Goods receipt queue (GR status WAITING_RECEIPT or PARTIALLY_RECEIVED)
  const grCount = state.goodsReceipts.filter(g => g.status === 'WAITING_RECEIPT' || g.status === 'PARTIALLY_RECEIVED').length;
  const badgeGRQueueEl = document.getElementById('badgeGRQueue');
  if (badgeGRQueueEl) badgeGRQueueEl.textContent = grCount;

  // Total warehouse tasks badge (Cek PR + DO)
  const badgeTotalTasksEl = document.getElementById('badgeGudangTotalTasks');
  if (badgeTotalTasksEl) badgeTotalTasksEl.textContent = gudangCount + grCount;

  // Fulfilled and Completed counts
  const fulfilledCount = state.requests.filter(r => r.status === 'FULFILLED_BY_STOCK').length;
  const grCompletedCount = state.goodsReceipts.filter(g => g.status === 'RECEIVED_COMPLETED').length;
  const completedPRCount = state.requests.filter(r => r.status === 'COMPLETED').length;
  const totalCompletedCount = grCompletedCount + completedPRCount;

  // Warehouse Action Card Badges
  const cardDOBadge = document.getElementById('whCardDOBadge');
  if (cardDOBadge) cardDOBadge.textContent = `${grCount} Menunggu`;
  const cardPRBadge = document.getElementById('whCardPRBadge');
  if (cardPRBadge) cardPRBadge.textContent = `${gudangCount} Antrean`;
  const cardFulfilledBadge = document.getElementById('whCardFulfilledBadge');
  if (cardFulfilledBadge) cardFulfilledBadge.textContent = `${fulfilledCount} Terpenuhi`;
  const cardCompletedBadge = document.getElementById('whCardCompletedBadge');
  if (cardCompletedBadge) cardCompletedBadge.textContent = `${totalCompletedCount} Tuntas`;

  // Warehouse KPI Card Numbers
  const kpiPRQ = document.getElementById('whKpiPRQueue');
  if (kpiPRQ) kpiPRQ.textContent = gudangCount;
  const kpiGRQ = document.getElementById('whKpiGRQueue');
  if (kpiGRQ) kpiGRQ.textContent = grCount;
  const kpiFulfilled = document.getElementById('whKpiFulfilled');
  if (kpiFulfilled) kpiFulfilled.textContent = fulfilledCount;
  const kpiCompletedWh = document.getElementById('whKpiCompleted');
  if (kpiCompletedWh) kpiCompletedWh.textContent = totalCompletedCount;

  // Warehouse Hero Banner staff info
  const staffNameEl = document.getElementById('whHeroStaffName');
  if (staffNameEl && u) {
    staffNameEl.textContent = `${u.full_name} (${u.role_name})`;
  }

  // Approver PR queue for current user's level
  const approverCount = state.requests.filter(r => r.status === 'PENDING_APPROVAL' && r.current_approval_level === u.role_level).length;
  const badgeApproverQueueEl = document.getElementById('badgeApproverQueue');
  if (badgeApproverQueueEl) badgeApproverQueueEl.textContent = approverCount;

  // PO queue waiting approval
  const poCount = state.purchaseOrders.filter(p => p.status === 'WAITING_PO_APPROVAL').length;
  const badgePOQueueEl = document.getElementById('badgePOQueue');
  if (badgePOQueueEl) badgePOQueueEl.textContent = poCount;

  // Purchasing PR Pool (APPROVED)
  const poolCount = state.requests.filter(r => r.status === 'APPROVED').length;
  const badgePurchasingQueueEl = document.getElementById('badgePurchasingQueue');
  if (badgePurchasingQueueEl) badgePurchasingQueueEl.textContent = poolCount;

  // Dashboard KPI numbers
  const kpiTotalPREl = document.getElementById('kpiTotalPR');
  if (kpiTotalPREl) kpiTotalPREl.textContent = state.requests.length;
  const kpiInWarehouseEl = document.getElementById('kpiInWarehouse');
  if (kpiInWarehouseEl) kpiInWarehouseEl.textContent = gudangCount;
  const kpiMyActionEl = document.getElementById('kpiMyAction');
  if (kpiMyActionEl) kpiMyActionEl.textContent = approverCount;
  const kpiCompletedEl = document.getElementById('kpiCompleted');
  if (kpiCompletedEl) kpiCompletedEl.textContent = completedPRCount;
}

// ============================================================================
// ROLE SWITCHER
// ============================================================================

async function handleRoleChange(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/switch-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(userId) })
    });
    const json = await res.json();
    if (json.success) {
      if (json.token) {
        localStorage.setItem('flowrequest_jwt_token', json.token);
      }
      state.currentUser = json.data;

      updateCurrentUserUI();
      await refreshAllData();
      if (json.data.role_level === 2 || json.data.username === 'joko_gudang') {
        switchView('gudang-dashboard');
      } else {
        renderCurrentView();
      }
      showToast('Peran Berubah', `Aktif sebagai: ${json.data.full_name} (${json.data.role_name})`, 'success');
    }
  } catch (err) {
    showToast('Error', 'Gagal mengganti peran pengguna.', 'danger');
  }
}

// ============================================================================
// VIEW SWITCHING
// ============================================================================

function switchView(viewName) {
  state.activeView = viewName;

  // Hide all view pages
  document.querySelectorAll('.win-view-page').forEach(el => el.style.display = 'none');

  // Update navigation rail active class
  document.querySelectorAll('.win-nav-item').forEach(el => el.classList.remove('active'));

  // Map view name to element and nav item
  const pageMap = {
    'dashboard': { id: 'view-dashboard', title: '📊 Dashboard Beranda', sub: 'Ringkasan status permohonan, alur pengadaan, dan metrik sistem' },
    'gudang-dashboard': { id: 'view-gudang-dashboard', title: '🏭 Pusat Operasional Gudang & Logistik', sub: 'Monitoring stok rak fisik, antrean form PR, dan penerimaan surat jalan DO vendor' },
    'create-pr': { id: 'view-create-pr', title: '📝 Formulir Permohonan Pengadaan Barang (PR)', sub: 'Isi formulir kebutuhan barang dan estimasi anggaran pengadaan' },
    'my-pr': { id: 'view-my-pr', title: '📋 Riwayat Permohonan Saya', sub: 'Daftar dan status dokumen pengadaan yang Anda ajukan' },
    'gudang-verify': { id: 'view-gudang-verify', title: '📦 Verifikasi Fisik Ketersediaan Stok Gudang', sub: 'Pemeriksaan rak barang eksisting sebelum dokumen diteruskan ke pimpinan' },
    'gudang-receipt': { id: 'view-gudang-receipt', title: '🚚 Penerimaan Barang Masuk & QC (DO)', sub: 'Verifikasi surat jalan vendor dan kuantitas barang fisik yang masuk gudang' },
    'approver-pr': { id: 'view-approver-pr', title: '⚡ Antrean Otorisasi Permohonan Barang (PR)', sub: 'Dynamic threshold routing evaluation & approval berjenjang' },
    'approver-po': { id: 'view-approver-po', title: '📑 Otorisasi Purchase Order (Manager Level 6+)', sub: 'Persetujuan resmi dokumen PO sebelum diterbitkan ke vendor' },
    'purchasing': { id: 'view-purchasing', title: '🛒 Purchasing & Penerbitan Dokumen Vendor', sub: 'Pembentukan Draft PO dari PR approved dan rilis dokumen resmi ke vendor' },
    'admin-limits': { id: 'view-admin-limits', title: '⚙️ Konfigurasi Dynamic PR Threshold', sub: 'Master plafon limit wewenang persetujuan Level 3 s/d Level 8' },
    'admin-users': { id: 'view-admin-users', title: '👥 Manajemen Pengguna & Hak Akses (RBAC)', sub: 'Kelola akun pegawai, departemen, dan peran wewenang sistem' },
    'audit-logs': { id: 'view-audit-logs', title: '📜 Riwayat Jejak Audit Transaksi (Audit Trail)', sub: 'Catatan terperinci mutasi status dan keputusan pimpinan' }
  };

  const target = pageMap[viewName] || pageMap['dashboard'];
  const el = document.getElementById(target.id);
  if (el) el.style.display = 'block';

  document.getElementById('pageTitle').innerHTML = `<span>${target.title}</span>`;
  document.getElementById('pageSubtitle').textContent = target.sub;

  // Highlight active nav item
  const navItems = document.querySelectorAll('.win-nav-item');
  navItems.forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(viewName)) {
      n.classList.add('active');
    }
  });

  renderCurrentView();
}

function renderCurrentView() {
  switch (state.activeView) {
    case 'dashboard':
      renderDashboardTable();
      break;
    case 'gudang-dashboard':
      renderGudangDashboard();
      break;
    case 'my-pr':
      renderMyPRTable();
      break;
    case 'gudang-verify':
      renderGudangQueueTable();
      break;
    case 'gudang-receipt':
      renderGRQueueTable();
      break;
    case 'approver-pr':
      renderApproverPRTable();
      break;
    case 'approver-po':
      renderPOApprovalTable();
      break;
    case 'purchasing':
      renderPurchasingTables();
      break;
    case 'admin-limits':
      renderAdminLimitsTable();
      break;
    case 'admin-users':
      renderAdminUsersTable();
      break;
    case 'audit-logs':
      renderAuditLogsTable();
      break;
  }
}

async function refreshCurrentView() {
  await refreshAllData();
  renderCurrentView();
  showToast('Data Diperbarui', 'Seluruh antrean transaksi telah dimutakhirkan.', 'success');
}

// ============================================================================
// STATUS BADGE RENDER HELPER
// ============================================================================

function getStatusBadge(status) {
  switch (status) {
    case 'DRAFT':
      return `<span class="badge badge-draft">Draft</span>`;
    case 'SUBMITTED_TO_GUDANG':
      return `<span class="badge badge-gudang">Verifikasi Stok Gudang</span>`;
    case 'FULFILLED_BY_STOCK':
      return `<span class="badge badge-completed">✓ Terpenuhi Stok Gudang</span>`;
    case 'PENDING_APPROVAL':
      return `<span class="badge badge-approval">⏳ Menunggu Otorisasi</span>`;
    case 'APPROVED':
      return `<span class="badge badge-approved">✓ Disetujui Final</span>`;
    case 'IN_PO_PROCESS':
      return `<span class="badge badge-po">Proses PO Vendor</span>`;
    case 'RELEASED_TO_VENDOR':
      return `<span class="badge badge-po">PO Dirilis ke Vendor</span>`;
    case 'WAITING_RECEIPT':
      return `<span class="badge badge-gudang">Menunggu Kedatangan Barang</span>`;
    case 'PARTIALLY_RECEIVED':
      return `<span class="badge badge-gudang">Diterima Sebagian (Parsial)</span>`;
    case 'RECEIVED_COMPLETED':
    case 'COMPLETED':
      return `<span class="badge badge-completed">✓ Selesai / Diterima Lengkap</span>`;
    case 'REJECTED':
      return `<span class="badge badge-rejected">✗ Ditolak</span>`;
    default:
      return `<span class="badge badge-draft">${status}</span>`;
  }
}

// ============================================================================
// VIEW 1: DASHBOARD TABLE
// ============================================================================

function renderDashboardTable() {
  const tbody = document.getElementById('dashboardPRTableBody');
  if (!tbody) return;

  if (!state.requests.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#64748b;">Belum ada dokumen permohonan.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.requests.map(pr => {
    let positionText = '-';
    if (pr.status === 'SUBMITTED_TO_GUDANG') positionText = 'Staf Gudang (Cek Fisik Rak)';
    else if (pr.status === 'PENDING_APPROVAL') positionText = `Pimpinan Level ${pr.current_approval_level}`;
    else if (pr.status === 'APPROVED') positionText = 'Bagian Purchasing (Draft PO)';
    else if (pr.status === 'IN_PO_PROCESS' || pr.status === 'RELEASED_TO_VENDOR') positionText = 'Vendor Eksternal & Gudang';
    else if (pr.status === 'FULFILLED_BY_STOCK') positionText = 'Gudang (Langsung Serah Terima)';
    else if (pr.status === 'COMPLETED') positionText = 'Selesai di Rak Gudang';
    else if (pr.status === 'REJECTED') positionText = 'Dikembalikan ke Pemohon';

    const totalVal = pr.total_need_purchase_amount !== undefined ? pr.total_need_purchase_amount : pr.total_estimated_amount;

    return `
      <tr>
        <td><strong class="code-badge">${pr.pr_number}</strong></td>
        <td>${pr.request_date}</td>
        <td>
          <div style="font-weight:600;">${pr.requestor_name}</div>
          <div style="font-size:11px; color:#64748b;">${pr.department_name}</div>
        </td>
        <td>
          <div style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${pr.purpose}">
            ${pr.purpose}
          </div>
          <span style="font-size:10px; color:${pr.urgency === 'MENDESAK' ? '#dc2626' : '#64748b'}; font-weight:600;">
            [${pr.urgency}]
          </span>
        </td>
        <td style="font-family:var(--font-mono); font-weight:700;">
          Rp ${totalVal.toLocaleString('id-ID')}
        </td>
        <td>${getStatusBadge(pr.status)}</td>
        <td style="font-size:11px; font-weight:500; color:#334155;">${positionText}</td>
        <td>
          <button class="win-btn win-btn-sm" onclick="showPRDetailModal(${pr.id})">Tinjau</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// VIEW 2: FORM PENGAJUAN PR (CREATE PR) WITH DYNAMIC PREDICTOR
// ============================================================================

function initPRFormDefaults() {
  const reqDate = document.getElementById('prFormRequiredDate');
  if (reqDate) {
    const d = new Date(Date.now() + 7 * 86400000);
    reqDate.value = d.toISOString().slice(0, 10);
  }

  // Clear and add 2 initial rows
  const tbody = document.getElementById('prFormItemsBody');
  if (tbody) {
    tbody.innerHTML = '';
    addPRFormItemRow('Laptop Komputer Kerja Core i7, RAM 16GB, SSD 512GB', 'ThinkPad E14 Gen 5', 1, 'Unit', 14500000);
    addPRFormItemRow('Monitor LED 24 Inch IPS Frameless 75Hz', 'Dell P2422H FHD', 1, 'Unit', 2750000);
  }
}

function addPRFormItemRow(name = '', spec = '', qty = 1, unit = 'Unit', price = 0) {
  const tbody = document.getElementById('prFormItemsBody');
  const rowCount = tbody.children.length + 1;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="text-align:center; font-weight:600; color:#64748b;">${rowCount}</td>
    <td><input type="text" class="win-input item-name" value="${name}" placeholder="Contoh: Kertas HVS A4"></td>
    <td><input type="text" class="win-input item-spec" value="${spec}" placeholder="Merk, spek teknis"></td>
    <td><input type="number" min="1" class="win-input item-qty" value="${qty}" oninput="recalculatePRFormTotal()"></td>
    <td>
      <select class="win-select item-unit">
        <option ${unit === 'Unit' ? 'selected' : ''}>Unit</option>
        <option ${unit === 'Pcs' ? 'selected' : ''}>Pcs</option>
        <option ${unit === 'Rim' ? 'selected' : ''}>Rim</option>
        <option ${unit === 'Set' ? 'selected' : ''}>Set</option>
        <option ${unit === 'Box' ? 'selected' : ''}>Box</option>
        <option ${unit === 'Pak' ? 'selected' : ''}>Pak</option>
      </select>
    </td>
    <td><input type="number" min="0" step="1000" class="win-input item-price" value="${price}" oninput="recalculatePRFormTotal()"></td>
    <td class="item-subtotal" style="font-family:var(--font-mono); font-weight:700; text-align:right;">Rp 0</td>
    <td>
      <button type="button" class="win-btn win-btn-sm win-btn-danger" onclick="deletePRFormRow(this)" title="Hapus baris">&#x2715;</button>
    </td>
  `;
  tbody.appendChild(tr);
  recalculatePRFormTotal();
}

function deletePRFormRow(btn) {
  const tbody = document.getElementById('prFormItemsBody');
  if (tbody.children.length <= 1) {
    showToast('Peringatan', 'Minimal harus terdapat 1 barang dalam permohonan.', 'warning');
    return;
  }
  btn.closest('tr').remove();
  // Re-number
  Array.from(tbody.children).forEach((tr, idx) => {
    tr.children[0].textContent = idx + 1;
  });
  recalculatePRFormTotal();
}

function recalculatePRFormTotal() {
  const tbody = document.getElementById('prFormItemsBody');
  let grandTotal = 0;

  Array.from(tbody.children).forEach(tr => {
    const qty = Number(tr.querySelector('.item-qty').value) || 0;
    const price = Number(tr.querySelector('.item-price').value) || 0;
    const lineTotal = qty * price;
    tr.querySelector('.item-subtotal').textContent = `Rp ${lineTotal.toLocaleString('id-ID')}`;
    grandTotal += lineTotal;
  });

  document.getElementById('prFormGrandTotal').textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;

  // Update Escalation Prediction Stepper
  updatePRPredictionStepper(grandTotal);
}

function updatePRPredictionStepper(total) {
  const badge = document.getElementById('prPredictBadge');
  const steps = ['step-l3', 'step-l4', 'step-l5', 'step-l6', 'step-l7', 'step-l8'];

  // Reset steps
  steps.forEach(id => {
    const s = document.getElementById(id);
    if (s) s.className = 'win-step';
  });

  let targetLevel = 3;
  let targetName = 'Supervisor (Level 3)';

  if (total <= 5000000) {
    targetLevel = 3;
    targetName = 'Level 3 (Supervisor)';
    document.getElementById('step-l3').classList.add('active');
  } else if (total <= 20000000) {
    targetLevel = 4;
    targetName = 'Level 4 (Kepala Bagian)';
    document.getElementById('step-l3').classList.add('completed');
    document.getElementById('step-l4').classList.add('active');
  } else if (total <= 50000000) {
    targetLevel = 5;
    targetName = 'Level 5 (Asisten Manager)';
    document.getElementById('step-l3').classList.add('completed');
    document.getElementById('step-l4').classList.add('completed');
    document.getElementById('step-l5').classList.add('active');
  } else if (total <= 250000000) {
    targetLevel = 6;
    targetName = 'Level 6 (Manager)';
    document.getElementById('step-l3').classList.add('completed');
    document.getElementById('step-l4').classList.add('completed');
    document.getElementById('step-l5').classList.add('completed');
    document.getElementById('step-l6').classList.add('active');
  } else if (total <= 1000000000) {
    targetLevel = 7;
    targetName = 'Level 7 (Direktur)';
    ['step-l3', 'step-l4', 'step-l5', 'step-l6'].forEach(id => document.getElementById(id).classList.add('completed'));
    document.getElementById('step-l7').classList.add('active');
  } else {
    targetLevel = 8;
    targetName = 'Level 8 (Direktur Utama)';
    ['step-l3', 'step-l4', 'step-l5', 'step-l6', 'step-l7'].forEach(id => document.getElementById(id).classList.add('completed'));
    document.getElementById('step-l8').classList.add('active');
  }

  badge.textContent = `Membutuhkan: ${targetName}`;
}

async function submitNewPRForm() {
  const purpose = document.getElementById('prFormPurpose').value.trim();
  const reqDate = document.getElementById('prFormRequiredDate').value;
  const urgency = document.getElementById('prFormUrgency').value;

  if (!purpose) {
    showToast('Validasi Gagal', 'Harap isi alasan dan keperluan pengadaan barang.', 'warning');
    return;
  }

  const rows = document.querySelectorAll('#prFormItemsBody tr');
  const items = [];

  for (const tr of rows) {
    const name = tr.querySelector('.item-name').value.trim();
    const spec = tr.querySelector('.item-spec').value.trim();
    const qty = Number(tr.querySelector('.item-qty').value) || 0;
    const unit = tr.querySelector('.item-unit').value;
    const price = Number(tr.querySelector('.item-price').value) || 0;

    if (!name) {
      showToast('Validasi Gagal', 'Nama barang pada setiap baris tidak boleh kosong.', 'warning');
      return;
    }
    if (qty <= 0) {
      showToast('Validasi Gagal', 'Kuantitas barang harus lebih dari 0.', 'warning');
      return;
    }

    items.push({ item_name: name, specification: spec, qty_requested: qty, unit, estimated_unit_price: price });
  }

  try {
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose, required_date: reqDate, urgency, items })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Berhasil Diajukan', json.message, 'success');
      await refreshAllData();
      initPRFormDefaults();
      document.getElementById('prFormPurpose').value = '';
      switchView('dashboard');
    } else {
      showToast('Gagal Mengajukan', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal mengirimkan formulir PR ke server.', 'danger');
  }
}

// ============================================================================
// VIEW 3: RIWAYAT PR SAYA
// ============================================================================

function renderMyPRTable() {
  const tbody = document.getElementById('myPRTableBody');
  if (!tbody) return;

  const u = state.currentUser;
  const list = state.requests.filter(r => r.requestor_id === u.id);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Belum ada riwayat permohonan dari akun Anda.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(pr => `
    <tr>
      <td><strong class="code-badge">${pr.pr_number}</strong></td>
      <td>${pr.request_date}</td>
      <td>
        <div style="font-weight:600;">${pr.purpose}</div>
        <div style="font-size:11px; color:#64748b;">Target: ${pr.required_date}</div>
      </td>
      <td style="font-family:var(--font-mono); font-weight:700;">
        Rp ${pr.total_estimated_amount.toLocaleString('id-ID')}
      </td>
      <td>${getStatusBadge(pr.status)}</td>
      <td style="font-size:11px;">${pr.current_approval_level ? `Menunggu Approval Level ${pr.current_approval_level}` : (pr.final_approver_name || '-')}</td>
      <td>
        <button class="win-btn win-btn-sm" onclick="showPRDetailModal(${pr.id})">Lacak & Pratinjau</button>
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// ============================================================================
// VIEW: DASHBOARD GUDANG (CLONED FROM e:\gudang WORKFLOW TEMPLATE)
// ============================================================================

function setupGudangClock() {
  function updateClock() {
    const el = document.getElementById('whLiveClock');
    if (!el) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
    el.textContent = timeStr;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

function renderGudangDashboard() {
  const tbody = document.getElementById('whPriorityTasksTableBody');
  const countBadge = document.getElementById('whTaskCountBadge');
  if (!tbody) return;

  const currentFilter = state.gudangTaskFilter || 'ALL';

  // Build combined priority tasks list
  const tasks = [];

  // 1. Pending PRs awaiting warehouse rack check (Fase 1)
  const pendingPRs = state.requests.filter(r => r.status === 'SUBMITTED_TO_GUDANG');
  pendingPRs.forEach(pr => {
    tasks.push({
      type: 'PR_CHECK',
      typeLabel: '📦 Cek Stok PR',
      typeBadgeClass: 'badge badge-gudang',
      id: pr.id,
      docNumber: `<span class="code-badge">${pr.pr_number}</span>`,
      date: pr.request_date,
      party: `<strong>${pr.requestor_name}</strong><br><small style="color:#64748b;">${pr.department_name}</small>`,
      details: `<strong>${pr.items.length} Macam Barang</strong><div style="font-size:11px; color:#475569; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pr.purpose}</div>`,
      status: pr.status,
      actionHtml: `
        <button class="win-btn win-btn-sm win-btn-primary" onclick="showGudangVerifyModal(${pr.id})">
          🔍 Cek Fisik Rak
        </button>
      `
    });
  });

  // 2. Goods Receipts waiting delivery order / physical receiving (Fase 3)
  const pendingGRs = state.goodsReceipts.filter(g => g.status === 'WAITING_RECEIPT' || g.status === 'PARTIALLY_RECEIVED');
  pendingGRs.forEach(gr => {
    tasks.push({
      type: 'DO_RECEIPT',
      typeLabel: '🚚 Penerimaan DO',
      typeBadgeClass: 'badge badge-warning',
      id: gr.id,
      docNumber: `<span class="code-badge">${gr.receipt_number}</span><br><small style="color:#64748b;">Ref PO: ${gr.po_number}</small>`,
      date: gr.created_at ? gr.created_at.slice(0, 10) : '-',
      party: `<strong>${gr.vendor_name}</strong>`,
      details: `<strong>${gr.items ? gr.items.length : 1} Macam Barang</strong><div style="font-size:11px; color:#475569;">Surat Jalan: ${gr.vendor_delivery_note_number || '<em style="color:#94a3b8;">Menunggu Vendor</em>'}</div>`,
      status: gr.status,
      actionHtml: `
        <button class="win-btn win-btn-sm win-btn-success" onclick="showProcessGRModal(${gr.id})">
          🚚 Catat DO & QC
        </button>
      `
    });
  });

  // 3. Fulfilled by stock PRs (Fase 1 Selesai dari stok internal)
  const fulfilledPRs = state.requests.filter(r => r.status === 'FULFILLED_BY_STOCK');
  fulfilledPRs.forEach(pr => {
    tasks.push({
      type: 'FULFILLED',
      typeLabel: '✅ Stok Rak Lengkap',
      typeBadgeClass: 'badge badge-completed',
      id: pr.id,
      docNumber: `<span class="code-badge">${pr.pr_number}</span>`,
      date: pr.request_date,
      party: `<strong>${pr.requestor_name}</strong><br><small style="color:#64748b;">${pr.department_name}</small>`,
      details: `<span style="color:#15803d; font-weight:600;">Terpenuhi 100% dari stok rak internal</span><div style="font-size:11px; color:#64748b;">Siap diserahterimakan ke pemohon</div>`,
      status: pr.status,
      actionHtml: `
        <button class="win-btn win-btn-sm" onclick="showPRDetailModal(${pr.id})">
          👁️ Detail PR
        </button>
      `
    });
  });

  // 4. Completed Goods Receipts (Fase 3 Selesai QC dan Masuk Rak)
  const completedGRs = state.goodsReceipts.filter(g => g.status === 'RECEIVED_COMPLETED');
  completedGRs.forEach(gr => {
    tasks.push({
      type: 'COMPLETED',
      typeLabel: '🏁 QC & Rak Selesai',
      typeBadgeClass: 'badge badge-completed',
      id: gr.id,
      docNumber: `<span class="code-badge">${gr.receipt_number}</span><br><small style="color:#64748b;">PO: ${gr.po_number}</small>`,
      date: gr.created_at ? gr.created_at.slice(0, 10) : '-',
      party: `<strong>${gr.vendor_name}</strong>`,
      details: `Surat Jalan: <strong>${gr.vendor_delivery_note_number || '-'}</strong><div style="font-size:11px; color:#15803d;">Barang tersimpan di rak penyimpanan</div>`,
      status: gr.status,
      actionHtml: `
        <button class="win-btn win-btn-sm" onclick="showOfficialPrintModal(${gr.purchase_order_id}, 'PO')">
          🖨️ Cetak Bukti
        </button>
      `
    });
  });

  // Filter tasks based on currentFilter
  let filtered = tasks;
  if (currentFilter === 'PR') {
    filtered = tasks.filter(t => t.type === 'PR_CHECK');
  } else if (currentFilter === 'DO') {
    filtered = tasks.filter(t => t.type === 'DO_RECEIPT');
  } else if (currentFilter === 'DONE') {
    filtered = tasks.filter(t => t.type === 'FULFILLED' || t.type === 'COMPLETED');
  } else if (currentFilter === 'FULFILLED') {
    filtered = tasks.filter(t => t.type === 'FULFILLED');
  } else if (currentFilter === 'COMPLETED') {
    filtered = tasks.filter(t => t.type === 'COMPLETED');
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Tugas`;
  }

  // Update filter buttons styling
  const filterBtns = {
    'ALL': document.getElementById('btnFilterAllTasks'),
    'PR': document.getElementById('btnFilterPRTasks'),
    'DO': document.getElementById('btnFilterDOTasks'),
    'DONE': document.getElementById('btnFilterDoneTasks')
  };

  Object.entries(filterBtns).forEach(([key, btn]) => {
    if (!btn) return;
    if (key === currentFilter || (currentFilter === 'ALL' && key === 'ALL')) {
      btn.classList.add('win-btn-primary');
    } else {
      btn.classList.remove('win-btn-primary');
    }
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">Tidak ada tugas pada filter "${currentFilter}". Operasional gudang berjalan optimal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><span class="${t.typeBadgeClass}">${t.typeLabel}</span></td>
      <td>${t.docNumber}</td>
      <td>${t.date}</td>
      <td>${t.party}</td>
      <td>${t.details}</td>
      <td>${getStatusBadge(t.status)}</td>
      <td style="text-align:right;">${t.actionHtml}</td>
    </tr>
  `).join('');
}

function filterGudangTasks(filterType) {
  state.gudangTaskFilter = filterType;
  renderGudangDashboard();
}

// ============================================================================
// VIEW 4: GUDANG STOCK VERIFICATION
// ============================================================================

function renderGudangQueueTable() {
  const tbody = document.getElementById('gudangQueueTableBody');
  if (!tbody) return;

  const queue = state.requests.filter(r => r.status === 'SUBMITTED_TO_GUDANG');
  if (!queue.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Tidak ada antrean PR yang menunggu pengecekan fisik stok gudang.</td></tr>`;
    return;
  }

  tbody.innerHTML = queue.map(pr => `
    <tr>
      <td><strong class="code-badge">${pr.pr_number}</strong></td>
      <td>${pr.request_date}</td>
      <td>
        <div style="font-weight:600;">${pr.requestor_name}</div>
        <div style="font-size:11px; color:#64748b;">${pr.department_name}</div>
      </td>
      <td>
        <div style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pr.purpose}</div>
      </td>
      <td>${pr.items.length} Macam Barang</td>
      <td style="font-family:var(--font-mono); font-weight:700;">Rp ${pr.total_estimated_amount.toLocaleString('id-ID')}</td>
      <td>
        <button class="win-btn win-btn-sm win-btn-primary" onclick="showGudangVerifyModal(${pr.id})">
          🔍 Input Stok Fisik
        </button>
      </td>
    </tr>
  `).join('');
}

function showGudangVerifyModal(prId) {
  const pr = state.requests.find(r => r.id === prId);
  if (!pr) return;
  state.selectedPR = pr;

  document.getElementById('gudangModalTitle').textContent = `Verifikasi Stok Fisik Gudang &bull; ${pr.pr_number}`;
  const container = document.getElementById('gudangModalItemsContainer');

  container.innerHTML = `
    <table class="win-table" style="border:1px solid var(--win-border); border-radius:6px; overflow:hidden;">
      <thead>
        <tr>
          <th>Nama Barang & Spek</th>
          <th style="width:90px;">Qty Minta</th>
          <th style="width:110px;">Stok Rak Gudang *</th>
          <th style="width:100px;">Qty Dibeli (PO)</th>
          <th>Catatan Kondisi Rak</th>
        </tr>
      </thead>
      <tbody>
        ${pr.items.map(it => `
          <tr data-item-id="${it.id}">
            <td>
              <div style="font-weight:600;">${it.item_name}</div>
              <div style="font-size:11px; color:#64748b;">${it.specification || '-'}</div>
            </td>
            <td style="font-weight:700; text-align:center;">${it.qty_requested} ${it.unit}</td>
            <td>
              <input type="number" min="0" max="${it.qty_requested}" class="win-input g-stock-val" value="${it.warehouse_stock_qty || 0}" oninput="recalcGudangRow(this, ${it.qty_requested})">
            </td>
            <td class="g-buy-val" style="font-weight:700; color:#dc2626; font-family:var(--font-mono); text-align:center;">
              ${Math.max(0, it.qty_requested - (it.warehouse_stock_qty || 0))} ${it.unit}
            </td>
            <td>
              <input type="text" class="win-input g-notes-val" placeholder="Rak E-04 / Kondisi baik" value="${it.warehouse_notes || ''}">
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  openModal('modalGudangVerify');
}

function recalcGudangRow(input, requestedQty) {
  const stock = Number(input.value) || 0;
  const tr = input.closest('tr');
  const buyQty = Math.max(0, requestedQty - stock);
  const buyEl = tr.querySelector('.g-buy-val');
  if (buyEl) {
    buyEl.textContent = `${buyQty} Pcs`;
    buyEl.style.color = buyQty === 0 ? '#15803d' : '#dc2626';
  }
}

function quickFillGudangStock(mode) {
  const container = document.getElementById('gudangModalItemsContainer');
  if (!container || !state.selectedPR) return;

  const rows = container.querySelectorAll('tbody tr');
  rows.forEach(tr => {
    const itemId = Number(tr.getAttribute('data-item-id'));
    const item = state.selectedPR.items.find(i => i.id === itemId);
    const stockInput = tr.querySelector('.g-stock-val');
    if (!stockInput || !item) return;

    if (mode === 'all') {
      stockInput.value = item.qty_requested;
    } else {
      stockInput.value = 0;
    }
    recalcGudangRow(stockInput, item.qty_requested);
  });
  showToast('Pengisian Cepat', mode === 'all' ? 'Seluruh barang diisi penuh dari ketersediaan rak.' : 'Seluruh stok diisi 0 (perlu dibeli via PO).', 'info');
}

async function submitGudangVerification() {
  const pr = state.selectedPR;
  if (!pr) return;

  const rows = document.querySelectorAll('#gudangModalItemsContainer tbody tr');
  const verifications = [];

  rows.forEach(tr => {
    const itemId = Number(tr.getAttribute('data-item-id'));
    const stock = Number(tr.querySelector('.g-stock-val').value) || 0;
    const notes = tr.querySelector('.g-notes-val').value.trim();
    verifications.push({ itemId, warehouseStockQty: stock, warehouseNotes: notes });
  });

  try {
    const res = await fetch(`${API_BASE}/api/requests/${pr.id}/verify-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifications })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Verifikasi Berhasil', json.message, 'success');
      closeModal('modalGudangVerify');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Verifikasi', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses verifikasi stok gudang.', 'danger');
  }
}

// ============================================================================
// VIEW 5: ANTREAN APPROVAL PR (LEVEL 3 S/D 8)
// ============================================================================

let approverFilter = 'MY_QUEUE';

function filterApproverList(mode) {
  approverFilter = mode;
  renderApproverPRTable();
}

function renderApproverPRTable() {
  const tbody = document.getElementById('approverPRTableBody');
  if (!tbody) return;

  const u = state.currentUser;
  let list = state.requests.filter(r => r.status === 'PENDING_APPROVAL');

  if (approverFilter === 'MY_QUEUE') {
    list = list.filter(r => r.current_approval_level === u.role_level);
  }

  document.getElementById('approverInboxCountBadge').textContent = `${list.length} Dokumen Perlu Tindakan`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Tidak ada permohonan yang menunggu otorisasi pada giliran Anda saat ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(pr => {
    const totalVal = pr.total_need_purchase_amount !== undefined ? pr.total_need_purchase_amount : pr.total_estimated_amount;
    const myLimit = state.approvalLimits.find(l => l.level === u.role_level);
    const maxLim = myLimit ? myLimit.max_amount : (u.role_level === 8 ? Infinity : 0);

    const isMyTurn = pr.current_approval_level === u.role_level;
    const willEscalate = totalVal > maxLim && u.role_level !== 8;

    let evalBadge = '';
    if (!isMyTurn) {
      evalBadge = `<span class="badge badge-draft">Menunggu Level ${pr.current_approval_level}</span>`;
    } else if (willEscalate) {
      evalBadge = `<span class="badge badge-gudang" title="Melebihi limit Anda. Akan otomatis dieskalasikan ke Level ${u.role_level + 1}">⚡ Melebihi Limit (Akan Dieskalasikan ke L${u.role_level + 1})</span>`;
    } else {
      evalBadge = `<span class="badge badge-approved" title="Dalam limit wewenang. Akan disetujui final.">✓ Dalam Limit Wewenang (Final)</span>`;
    }

    return `
      <tr style="${isMyTurn ? 'background:#f0fdf4;' : ''}">
        <td><strong class="code-badge">${pr.pr_number}</strong></td>
        <td>${pr.request_date}</td>
        <td>
          <div style="font-weight:600;">${pr.requestor_name}</div>
          <div style="font-size:11px; color:#64748b;">${pr.department_name}</div>
        </td>
        <td style="min-width:240px;">
          <div style="font-size:11px; font-weight:600; color:#334155; margin-bottom:3px;">${pr.purpose}</div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${(pr.items || []).map(it => `
              <span style="display:inline-flex; align-items:center; gap:3px; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; border-radius:4px; padding:2px 6px; font-size:11px; font-weight:600;">
                <span>📦</span>
                <span>${it.item_name}</span>
                <span style="color:#2563eb; font-weight:700;">(${it.qty_to_buy !== undefined ? it.qty_to_buy : it.qty_requested} ${it.unit || ''})</span>
              </span>
            `).join('')}
          </div>
        </td>
        <td style="font-family:var(--font-mono); font-weight:700;">Rp ${totalVal.toLocaleString('id-ID')}</td>
        <td>${evalBadge}</td>
        <td>
          <span class="badge badge-approval">Level ${pr.current_approval_level}</span>
        </td>
        <td>
          <button class="win-btn win-btn-sm ${isMyTurn ? 'win-btn-primary' : ''}" onclick="showPRApproveModal(${pr.id})">
            ${isMyTurn ? '⚡ Evaluasi & Putuskan' : 'Tinjau'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function showPRApproveModal(prId) {
  const pr = state.requests.find(r => r.id === prId);
  if (!pr) return;
  state.selectedPR = pr;

  const u = state.currentUser;
  const totalVal = pr.total_need_purchase_amount !== undefined ? pr.total_need_purchase_amount : pr.total_estimated_amount;
  const myLimit = state.approvalLimits.find(l => l.level === u.role_level);
  const maxLim = myLimit ? myLimit.max_amount : (u.role_level === 8 ? Infinity : 0);

  const isMyTurn = pr.current_approval_level === u.role_level;
  const willEscalate = totalVal > maxLim && u.role_level !== 8;

  document.getElementById('approveModalTitle').textContent = `Evaluasi Otorisasi • ${pr.pr_number}`;
  const body = document.getElementById('approveModalBody');

  body.innerHTML = `
    <div style="background:#f8fafc; border:1px solid var(--win-border); border-radius:6px; padding:12px; margin-bottom:12px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px;">
        <div><strong>Pemohon:</strong> ${pr.requestor_name} (${pr.department_name})</div>
        <div><strong>Keperluan:</strong> ${pr.purpose}</div>
        <div><strong>Total Anggaran Belanja:</strong> <span style="font-family:var(--font-mono); font-weight:700; color:#0067c0;">Rp ${totalVal.toLocaleString('id-ID')}</span></div>
        <div><strong>Batas Wewenang Anda:</strong> <span style="font-family:var(--font-mono); font-weight:700;">${u.role_level === 8 ? 'Unlimited' : `Rp ${maxLim.toLocaleString('id-ID')}`}</span></div>
      </div>
    </div>

    <!-- TABEL RINCIAN NAMA BARANG YANG HENDAK DISETUJUI -->
    <div style="margin-bottom:12px;">
      <div style="font-weight:700; font-size:12px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
        <span>📦 Daftar Barang yang Hendak Disetujui:</span>
        <span class="badge badge-approval">${(pr.items || []).length} Macam Barang</span>
      </div>
      <div style="border:1px solid var(--win-border); border-radius:6px; overflow:hidden;">
        <table class="win-table" style="margin:0; font-size:11px;">
          <thead>
            <tr>
              <th>Nama Barang & Spesifikasi</th>
              <th style="text-align:center; width:80px;">Qty Minta</th>
              <th style="text-align:center; width:90px;">Stok Gudang</th>
              <th style="text-align:center; width:90px; color:#dc2626;">Qty Beli</th>
              <th style="text-align:right; width:110px;">Estimasi Harga</th>
              <th style="text-align:right; width:120px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(pr.items || []).map(it => {
              const buyQty = it.qty_to_buy !== undefined ? it.qty_to_buy : it.qty_requested;
              const unitPrice = it.estimated_unit_price || 0;
              const lineTotal = buyQty * unitPrice;
              return `
                <tr>
                  <td>
                    <div style="font-weight:700; color:#0f172a;">${it.item_name}</div>
                    <div style="font-size:10px; color:#64748b;">${it.specification || '-'}</div>
                  </td>
                  <td style="text-align:center; font-weight:600;">${it.qty_requested} ${it.unit || ''}</td>
                  <td style="text-align:center; color:#d97706; font-weight:600;">${it.warehouse_stock_qty || 0} ${it.unit || ''}</td>
                  <td style="text-align:center; color:#dc2626; font-weight:700; font-family:var(--font-mono);">
                    ${buyQty} ${it.unit || ''}
                  </td>
                  <td style="text-align:right; font-family:var(--font-mono);">Rp ${unitPrice.toLocaleString('id-ID')}</td>
                  <td style="text-align:right; font-family:var(--font-mono); font-weight:700; color:#0067c0;">
                    Rp ${lineTotal.toLocaleString('id-ID')}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:700;">
              <td colspan="5" style="text-align:right;">Total Nilai Pembelian (Qty Beli × Harga):</td>
              <td style="text-align:right; font-family:var(--font-mono); color:#0067c0; font-size:12px;">
                Rp ${totalVal.toLocaleString('id-ID')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    ${!isMyTurn ? `
      <div class="win-card" style="background:#fffbeb; border-color:#fde68a; margin-bottom:12px;">
        ⚠️ <strong>Pemberitahuan:</strong> Dokumen ini sedang berada pada antrean persetujuan <strong>Level ${pr.current_approval_level}</strong>. Peran Anda saat ini adalah <strong>Level ${u.role_level}</strong>. Anda hanya dapat meninjau data.
      </div>
    ` : ''}

    ${willEscalate ? `
      <div class="win-card" style="background:#eff6ff; border-color:#bfdbfe; margin-bottom:12px;">
        ⚡ <strong>Mekanisme Dynamic Threshold:</strong> Nominal belanja dokumen (Rp ${totalVal.toLocaleString('id-ID')}) melebihi batas wewenang role Anda (Maks Rp ${maxLim.toLocaleString('id-ID')}). Saat Anda menekan tombol Setujui, dokumen akan <strong>secara otomatis dieskalasikan ke Level ${u.role_level + 1}</strong>.
      </div>
    ` : `
      <div class="win-card" style="background:#f0fdf4; border-color:#bbf7d0; margin-bottom:12px;">
        ✅ <strong>Batas Wewenang Mencukupi:</strong> Nominal belanja dokumen berada dalam batas wewenang role Anda. Persetujuan Anda bersifat <strong>FINAL</strong> dan dokumen langsung diteruskan ke Purchasing.
      </div>
    `}

    <div class="win-form-group">
      <label class="win-label">Catatan Disposisi / Alasan Persetujuan / Penolakan</label>
      <textarea id="prApprovalNotes" class="win-textarea" placeholder="Tuliskan instruksi atau alasan..."></textarea>
    </div>
  `;

  const btnApprove = document.getElementById('btnExecuteApprove');
  if (btnApprove) {
    btnApprove.disabled = !isMyTurn;
    btnApprove.textContent = willEscalate ? `Setujui & Eskalasi ke Level ${u.role_level + 1}` : 'Setujui Secara Final';
  }

  openModal('modalPRApprove');
}

async function executePRApprove() {
  const pr = state.selectedPR;
  if (!pr) return;
  const notes = document.getElementById('prApprovalNotes').value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/requests/${pr.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Otorisasi Berhasil', json.message, 'success');
      closeModal('modalPRApprove');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Otorisasi Ditolak Sistem', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses persetujuan PR.', 'danger');
  }
}

async function executePRReject() {
  const pr = state.selectedPR;
  if (!pr) return;
  const notes = document.getElementById('prApprovalNotes').value.trim();

  if (!notes) {
    showToast('Validasi Gagal', 'Harap cantumkan alasan penolakan pada kolom catatan.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/requests/${pr.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: notes })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Dokumen Ditolak', json.message, 'warning');
      closeModal('modalPRApprove');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Menolak', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses penolakan PR.', 'danger');
  }
}

// ============================================================================
// VIEW 6: OTORISASI PURCHASE ORDER (LEVEL 6+)
// ============================================================================

function renderPOApprovalTable() {
  const tbody = document.getElementById('poApprovalTableBody');
  const alertBox = document.getElementById('poSecurityAlert');
  if (!tbody) return;

  const u = state.currentUser;
  const isEligible = u.role_level >= 6;

  if (alertBox) {
    alertBox.style.display = isEligible ? 'none' : 'block';
  }

  const list = state.purchaseOrders.filter(p => p.status === 'WAITING_PO_APPROVAL' || p.status === 'APPROVED');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Tidak ada Purchase Order yang menunggu otorisasi.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(po => `
    <tr>
      <td><strong class="code-badge">${po.po_number}</strong></td>
      <td>${po.po_date}</td>
      <td>
        <div style="font-weight:600;">${po.vendor_name}</div>
        <div style="font-size:11px; color:#64748b;">${po.payment_terms}</div>
      </td>
      <td style="min-width:200px;">
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${(po.items || []).map(it => `
            <span style="display:inline-flex; align-items:center; gap:3px; background:#f5f3ff; border:1px solid #ddd6fe; color:#5b21b6; border-radius:4px; padding:2px 6px; font-size:11px; font-weight:600;">
              <span>📦</span>
              <span>${it.item_name}</span>
              <span style="color:#7c3aed; font-weight:700;">(${it.qty} ${it.unit || ''})</span>
            </span>
          `).join('')}
        </div>
      </td>
      <td><span class="code-badge">${po.pr_number}</span></td>
      <td style="font-family:var(--font-mono); font-weight:700; color:#5c2d91;">
        Rp ${po.grand_total.toLocaleString('id-ID')}
      </td>
      <td>${getStatusBadge(po.status)}</td>
      <td>
        ${po.status === 'WAITING_PO_APPROVAL' ? `
          <button class="win-btn win-btn-sm win-btn-purple" onclick="approvePOAction(${po.id})" ${!isEligible ? 'disabled title="Dibutuhkan minimal Level 6"' : ''}>
            ✓ Setujui PO
          </button>
          <button class="win-btn win-btn-sm win-btn-danger" onclick="rejectPOAction(${po.id})" ${!isEligible ? 'disabled' : ''}>
            ✗ Tolak
          </button>
        ` : `
          <span style="font-size:11px; color:#15803d; font-weight:600;">✓ Disetujui (${po.approved_by_name})</span>
        `}
      </td>
    </tr>
  `).join('');
}

async function approvePOAction(poId) {
  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders/${poId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Disetujui untuk diterbitkan ke vendor rekanan.' })
    });
    const json = await res.json();
    if (json.success) {
      showToast('PO Disetujui', json.message, 'success');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Otorisasi Ditolak Sistem', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses otorisasi PO.', 'danger');
  }
}

async function rejectPOAction(poId) {
  const reason = prompt('Masukkan alasan penolakan Purchase Order:');
  if (!reason) return;

  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders/${poId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const json = await res.json();
    if (json.success) {
      showToast('PO Ditolak', json.message, 'warning');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Menolak', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses penolakan PO.', 'danger');
  }
}

// ============================================================================
// VIEW 7: PURCHASING (POOL PR & RILIS PO KE VENDOR)
// ============================================================================

function renderPurchasingTables() {
  const poolBody = document.getElementById('purchasingPRPoolBody');
  const poBody = document.getElementById('purchasingPOTableBody');

  // PR Pool (APPROVED)
  const pool = state.requests.filter(r => r.status === 'APPROVED');
  if (poolBody) {
    if (!pool.length) {
      poolBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">Tidak ada PR yang menunggu pembuatan PO. Seluruh PR approved sudah diproses.</td></tr>`;
    } else {
      poolBody.innerHTML = pool.map(pr => `
        <tr>
          <td><strong class="code-badge">${pr.pr_number}</strong></td>
          <td>${pr.approved_at ? pr.approved_at.slice(0, 10) : pr.request_date}</td>
          <td>
            <div style="font-weight:600;">${pr.requestor_name}</div>
            <div style="font-size:11px; color:#64748b;">${pr.department_name}</div>
          </td>
          <td>${pr.final_approver_name || 'Manajemen'}</td>
          <td style="font-family:var(--font-mono); font-weight:700;">Rp ${(pr.total_need_purchase_amount || pr.total_estimated_amount).toLocaleString('id-ID')}</td>
          <td>
            <button class="win-btn win-btn-sm win-btn-primary" onclick="showCreatePOModal(${pr.id})">
              + Buat Draft PO
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // PO Table
  if (poBody) {
    if (!state.purchaseOrders.length) {
      poBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Belum ada Purchase Order yang diterbitkan.</td></tr>`;
    } else {
      poBody.innerHTML = state.purchaseOrders.map(po => `
        <tr>
          <td><strong class="code-badge">${po.po_number}</strong></td>
          <td>${po.po_date}</td>
          <td>
            <div style="font-weight:600;">${po.vendor_name}</div>
            <div style="font-size:11px; color:#64748b;">${po.vendor_phone || '-'}</div>
          </td>
          <td style="font-family:var(--font-mono); font-weight:700; color:#5c2d91;">
            Rp ${po.grand_total.toLocaleString('id-ID')}
          </td>
          <td>${getStatusBadge(po.status)}</td>
          <td style="font-size:11px;">${po.approved_by_name || 'Menunggu Manager'}</td>
          <td>
            ${po.status === 'APPROVED' ? `
              <button class="win-btn win-btn-sm win-btn-success" onclick="releasePOToVendorAction(${po.id})">
                🚀 Rilis ke Vendor (Auto GR)
              </button>
            ` : po.status === 'RELEASED_TO_VENDOR' ? `
              <span class="badge badge-completed">✓ Dirilis ke Vendor</span>
              <button class="win-btn win-btn-sm" onclick="showOfficialPrintModal(${po.id}, 'PO')">🖨️ PO Resmi</button>
            ` : `
              <span style="font-size:11px; color:#64748b;">Menunggu Approval</span>
            `}
          </td>
        </tr>
      `).join('');
    }
  }
}

function showCreatePOModal(prId) {
  const pr = state.requests.find(r => r.id === prId);
  if (!pr) return;
  state.selectedPR = pr;

  const body = document.getElementById('createPOModalBody');
  body.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
      <div class="win-form-group">
        <label class="win-label">No. PR Acuan</label>
        <input type="text" class="win-input code-badge" value="${pr.pr_number}" readonly>
      </div>
      <div class="win-form-group">
        <label class="win-label">Pilih Vendor Rekanan *</label>
        <select id="poVendorSelect" class="win-select">
          ${state.vendors.map(v => `<option value="${v.id}">${v.name} &bull; ${v.payment_terms}</option>`).join('')}
        </select>
      </div>
      <div class="win-form-group">
        <label class="win-label">Estimasi Tanggal Pengiriman</label>
        <input type="date" id="poDeliveryDate" class="win-input" value="${new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}">
      </div>
      <div class="win-form-group">
        <label class="win-label">Termin Pembayaran</label>
        <input type="text" id="poPaymentTerms" class="win-input" value="Net 30 Days">
      </div>
    </div>

    <div class="win-table-wrap">
      <div class="win-table-header"><span class="win-table-title">Barang yang Akan Dipesan (Sesuai Kuantitas Beli)</span></div>
      <table class="win-table">
        <thead>
          <tr>
            <th>Barang</th>
            <th>Qty Beli</th>
            <th>Harga Satuan (Rp)</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${pr.items.filter(i => (i.qty_to_buy || i.qty_requested) > 0).map(i => {
            const qty = i.qty_to_buy || i.qty_requested;
            const sub = qty * i.estimated_unit_price;
            return `
              <tr>
                <td><strong>${i.item_name}</strong><br><small style="color:#64748b;">${i.specification || '-'}</small></td>
                <td>${qty} ${i.unit}</td>
                <td>Rp ${i.estimated_unit_price.toLocaleString('id-ID')}</td>
                <td style="font-family:var(--font-mono); font-weight:700;">Rp ${sub.toLocaleString('id-ID')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  openModal('modalCreatePO');
}

async function submitCreatePO() {
  const pr = state.selectedPR;
  if (!pr) return;

  const vendorId = document.getElementById('poVendorSelect').value;
  const deliveryDate = document.getElementById('poDeliveryDate').value;
  const paymentTerms = document.getElementById('poPaymentTerms').value;

  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: pr.id,
        vendor_id: vendorId,
        delivery_date: deliveryDate,
        payment_terms: paymentTerms,
        tax_rate: 11
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('PO Berhasil Dibuat', json.message, 'success');
      closeModal('modalCreatePO');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Membuat PO', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses pembuatan PO.', 'danger');
  }
}

async function releasePOToVendorAction(poId) {
  if (!confirm('Rilis Purchase Order resmi ini ke Vendor? Sistem akan secara otomatis menerbitkan tiket Goods Receipt ke antrean staf Gudang.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders/${poId}/release`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.success) {
      showToast('PO Diterbitkan ke Vendor', json.message, 'success');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Rilis PO', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal merilis PO ke vendor.', 'danger');
  }
}

// ============================================================================
// VIEW 8: GOODS RECEIPT (PENERIMAAN BARANG GUDANG)
// ============================================================================

function renderGRQueueTable() {
  const tbody = document.getElementById('grQueueTableBody');
  if (!tbody) return;

  if (!state.goodsReceipts.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Belum ada tiket penerimaan barang masuk.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.goodsReceipts.map(gr => `
    <tr>
      <td><strong class="code-badge">${gr.receipt_number}</strong></td>
      <td><span class="code-badge">${gr.po_number}</span></td>
      <td><strong>${gr.vendor_name}</strong></td>
      <td>${gr.created_at ? gr.created_at.slice(0, 10) : '-'}</td>
      <td>${getStatusBadge(gr.status)}</td>
      <td style="font-family:var(--font-mono); font-weight:600;">${gr.vendor_delivery_note_number || '<em style="color:#94a3b8;">Belum Tiba</em>'}</td>
      <td>
        ${gr.status !== 'RECEIVED_COMPLETED' ? `
          <button class="win-btn win-btn-sm win-btn-success" onclick="showProcessGRModal(${gr.id})">
            🚚 Catat Surat Jalan & QC
          </button>
        ` : `
          <span style="font-size:11px; color:#15803d; font-weight:600;">✓ Selesai Diverifikasi (${gr.warehouse_user_name || 'Gudang'})</span>
        `}
      </td>
    </tr>
  `).join('');
}

function showProcessGRModal(grId) {
  const gr = state.goodsReceipts.find(g => g.id === grId);
  if (!gr) return;
  state.selectedGR = gr;

  document.getElementById('grModalTitle').textContent = `Penerimaan Fisik & QC &bull; ${gr.receipt_number}`;
  const body = document.getElementById('grModalBody');

  body.innerHTML = `
    <div style="background:#f8fafc; border:1px solid var(--win-border); border-radius:6px; padding:12px; margin-bottom:14px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px;">
        <div><strong>No. Acuan PO:</strong> ${gr.po_number}</div>
        <div><strong>Vendor Pengirim:</strong> ${gr.vendor_name}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
      <div class="win-form-group">
        <label class="win-label">Nomor Surat Jalan / Delivery Order Vendor *</label>
        <input type="text" id="grVendorDeliveryNote" class="win-input" placeholder="Contoh: DO/SAD/2026/1089" value="${gr.vendor_delivery_note_number || ''}">
      </div>
      <div class="win-form-group">
        <label class="win-label">Catatan Pemeriksaan</label>
        <input type="text" id="grReceivingNotes" class="win-input" placeholder="Barang diterima lengkap segel utuh" value="${gr.receiving_notes || ''}">
      </div>
    </div>

    <div class="win-table-wrap">
      <div class="win-table-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span class="win-table-title">Verifikasi Kuantitas Masuk & Quality Control (QC)</span>
        <button type="button" class="checker-quick-fill-btn" onclick="quickFillGRPassQC()">⚡ Loloskan QC 100% (Semua Baik)</button>
      </div>
      <table class="win-table">
        <thead>
          <tr>
            <th>Barang</th>
            <th style="width:70px;">Qty PO</th>
            <th style="width:80px;">Diterima *</th>
            <th style="width:80px;">Diterima Baik</th>
            <th style="width:70px;">Cacat/Retur</th>
            <th>Lokasi Rak Bin</th>
          </tr>
        </thead>
        <tbody id="grItemsInputBody">
          ${gr.items.map(it => `
            <tr data-item-id="${it.id}">
              <td><strong>${it.item_name}</strong></td>
              <td style="text-align:center; font-weight:700;">${it.qty_ordered}</td>
              <td><input type="number" min="0" max="${it.qty_ordered}" class="win-input gr-received" value="${it.qty_received || it.qty_ordered}"></td>
              <td><input type="number" min="0" max="${it.qty_ordered}" class="win-input gr-accepted" value="${it.qty_accepted || it.qty_ordered}"></td>
              <td><input type="number" min="0" class="win-input gr-rejected" value="${it.qty_rejected || 0}"></td>
              <td><input type="text" class="win-input gr-bin" value="${it.warehouse_bin_location || 'RACK-A-01'}"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  openModal('modalProcessGR');
}

function quickFillGRPassQC() {
  const container = document.getElementById('grItemsInputBody');
  if (!container || !state.selectedGR) return;

  const rows = container.querySelectorAll('tr');
  rows.forEach(tr => {
    const itemId = Number(tr.getAttribute('data-item-id'));
    const item = state.selectedGR.items.find(i => i.id === itemId);
    if (!item) return;

    const recInput = tr.querySelector('.gr-received');
    const accInput = tr.querySelector('.gr-accepted');
    const rejInput = tr.querySelector('.gr-rejected');

    if (recInput) recInput.value = item.qty_ordered;
    if (accInput) accInput.value = item.qty_ordered;
    if (rejInput) rejInput.value = 0;
  });
  showToast('QC Otomatis', 'Kuantitas disetel 100% diterima baik dan lolos uji fisik.', 'info');
}

async function submitGRProcessing() {
  const gr = state.selectedGR;
  if (!gr) return;

  const deliveryNote = document.getElementById('grVendorDeliveryNote').value.trim();
  const notes = document.getElementById('grReceivingNotes').value.trim();

  if (!deliveryNote) {
    showToast('Validasi Gagal', 'Nomor Surat Jalan / Delivery Order vendor wajib diisi.', 'warning');
    return;
  }

  const rows = document.querySelectorAll('#grItemsInputBody tr');
  const items = [];

  rows.forEach(tr => {
    const id = Number(tr.getAttribute('data-item-id'));
    const rec = Number(tr.querySelector('.gr-received').value) || 0;
    const acc = Number(tr.querySelector('.gr-accepted').value) || 0;
    const rej = Number(tr.querySelector('.gr-rejected').value) || 0;
    const bin = tr.querySelector('.gr-bin').value.trim();
    items.push({ id, qty_received: rec, qty_accepted: acc, qty_rejected: rej, warehouse_bin_location: bin });
  });

  try {
    const res = await fetch(`${API_BASE}/api/goods-receipts/${gr.id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_delivery_note_number: deliveryNote,
        receiving_notes: notes,
        items
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Penerimaan Berhasil', json.message, 'success');
      closeModal('modalProcessGR');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Menerima', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memproses penerimaan barang gudang.', 'danger');
  }
}

// ============================================================================
// VIEW 9: ADMIN SYST000 (DYNAMIC PR THRESHOLD MATRIX)
// ============================================================================

function renderAdminLimitsTable() {
  const tbody = document.getElementById('adminLimitsTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.approvalLimits.map(lim => `
    <tr>
      <td><span class="badge badge-approval">Level ${lim.level}</span></td>
      <td><code>LEVEL_${lim.level}</code></td>
      <td><strong>${lim.role_name}</strong></td>
      <td style="font-family:var(--font-mono);">Rp ${lim.min_amount.toLocaleString('id-ID')}</td>
      <td style="font-family:var(--font-mono); font-weight:700; color:#0067c0;">
        ${lim.level === 8 ? 'Unlimited (> 1 Miliar)' : `Rp ${lim.max_amount.toLocaleString('id-ID')}`}
      </td>
      <td style="font-size:11px; color:#64748b;">${lim.updated_by_name || 'System Default'}</td>
      <td>
        <button class="win-btn win-btn-sm" onclick="showEditLimitModal(${lim.id})">Ubah Limit</button>
      </td>
    </tr>
  `).join('');
}

function showEditLimitModal(limitId) {
  const lim = state.approvalLimits.find(l => l.id === limitId);
  if (!lim) return;

  document.getElementById('editLimitId').value = lim.id;
  document.getElementById('editLimitRoleName').value = `${lim.role_name} (Level ${lim.level})`;
  document.getElementById('editLimitMin').value = lim.min_amount;
  document.getElementById('editLimitMax').value = lim.max_amount;

  openModal('modalEditLimit');
}

async function submitEditLimit() {
  const id = document.getElementById('editLimitId').value;
  const min = document.getElementById('editLimitMin').value;
  const max = document.getElementById('editLimitMax').value;

  try {
    const res = await fetch(`${API_BASE}/api/approval-limits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_amount: min, max_amount: max })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Limit Diperbarui', json.message, 'success');
      closeModal('modalEditLimit');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Memperbarui', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal memperbarui threshold limit.', 'danger');
  }
}

// ============================================================================
// VIEW 10: ADMIN SYST000 (USER MANAGEMENT)
// ============================================================================

function renderAdminUsersTable() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><code>${u.username}</code></td>
      <td><strong>${u.full_name}</strong></td>
      <td>${u.email}</td>
      <td><span class="badge badge-approval">${u.role_name} (Lvl ${u.role_level})</span></td>
      <td>${u.department_name || '-'}</td>
      <td>
        ${u.is_active ? '<span class="badge badge-completed">Aktif</span>' : '<span class="badge badge-rejected">Non-aktif</span>'}
      </td>
      <td>
        <button class="win-btn win-btn-sm" onclick="toggleUserStatusAction(${u.id})">
          ${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </td>
    </tr>
  `).join('');
}

function showAddUserModal() {
  const roleSel = document.getElementById('newUserRoleId');
  const deptSel = document.getElementById('newUserDeptId');

  roleSel.innerHTML = state.roles.map(r => `<option value="${r.id}">${r.role_name} (Level ${r.level})</option>`).join('');
  deptSel.innerHTML = state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  openModal('modalAddUser');
}

async function submitNewUser() {
  const username = document.getElementById('newUserUsername').value.trim();
  const fullName = document.getElementById('newUserFullName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const roleId = document.getElementById('newUserRoleId').value;
  const deptId = document.getElementById('newUserDeptId').value;

  if (!username || !fullName) {
    showToast('Validasi Gagal', 'Username dan Nama Lengkap wajib diisi.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, full_name: fullName, email, role_id: roleId, department_id: deptId })
    });
    const json = await res.json();
    if (json.success) {
      showToast('User Ditambahkan', json.message, 'success');
      closeModal('modalAddUser');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal Menambah User', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal mendaftarkan user baru.', 'danger');
  }
}

async function toggleUserStatusAction(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/users/${userId}/toggle-status`, { method: 'PUT' });
    const json = await res.json();
    if (json.success) {
      showToast('Status Diubah', json.message, 'success');
      await refreshAllData();
      renderCurrentView();
    } else {
      showToast('Gagal', json.message, 'danger');
    }
  } catch (err) {
    showToast('Error', 'Gagal mengubah status user.', 'danger');
  }
}

// ============================================================================
// VIEW 11: AUDIT TRAIL LOGS
// ============================================================================

function renderAuditLogsTable() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  if (!state.auditLogs.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#64748b;">Belum ada log mutasi.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.auditLogs.map(l => {
    const timeFormatted = new Date(l.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });
    return `
      <tr>
        <td style="font-size:11px; color:#64748b; font-family:var(--font-mono);">${timeFormatted}</td>
        <td><span class="badge badge-draft">${l.document_type}</span></td>
        <td><strong class="code-badge">${l.document_number}</strong></td>
        <td>
          <div style="font-weight:600;">${l.actor_name}</div>
          <div style="font-size:10.5px; color:#64748b;">${l.actor_role}</div>
        </td>
        <td><code>${l.action}</code></td>
        <td style="font-size:11px; color:#64748b;">${l.previous_status || '-'}</td>
        <td><span class="badge badge-approval">${l.new_status || '-'}</span></td>
        <td style="font-size:11px; color:#334155; max-width:280px;">${l.notes}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// PR DETAIL MODAL & STEPPER TRACKING
// ============================================================================

async function showPRDetailModal(prId) {
  try {
    const res = await fetch(`${API_BASE}/api/requests/${prId}`);
    const json = await res.json();
    if (!json.success) return;

    const pr = json.data;
    state.selectedPR = pr;

    document.getElementById('prModalTitle').textContent = `Lacak & Detail Permohonan &bull; ${pr.pr_number}`;
    const body = document.getElementById('prModalBody');

    // Stepper logic
    let step1Class = 'completed';
    let step2Class = pr.status === 'SUBMITTED_TO_GUDANG' ? 'active' : 'completed';
    let step3Class = pr.status === 'PENDING_APPROVAL' ? 'active' : (['APPROVED', 'IN_PO_PROCESS', 'RELEASED_TO_VENDOR', 'COMPLETED'].includes(pr.status) ? 'completed' : '');
    let step4Class = (pr.status === 'APPROVED' || pr.status === 'IN_PO_PROCESS') ? 'active' : (['RELEASED_TO_VENDOR', 'COMPLETED'].includes(pr.status) ? 'completed' : '');
    let step5Class = pr.status === 'COMPLETED' ? 'completed' : (pr.linkedGR ? 'active' : '');

    body.innerHTML = `
      <!-- Stepper Tracking -->
      <div class="win-card" style="margin-bottom:16px; background:#f8fafc;">
        <div class="win-stepper-wrap">
          <div class="win-step ${step1Class}">
            <div class="win-step-circle">1</div>
            <div class="win-step-title">Pengajuan PR</div>
            <div class="win-step-sub">${pr.requestor_name}</div>
          </div>
          <div class="win-step ${step2Class}">
            <div class="win-step-circle">2</div>
            <div class="win-step-title">Cek Stok Rak</div>
            <div class="win-step-sub">Staf Gudang</div>
          </div>
          <div class="win-step ${step3Class}">
            <div class="win-step-circle">3</div>
            <div class="win-step-title">Approval Berjenjang</div>
            <div class="win-step-sub">Pimpinan L3-L8</div>
          </div>
          <div class="win-step ${step4Class}">
            <div class="win-step-circle">4</div>
            <div class="win-step-title">Penerbitan PO</div>
            <div class="win-step-sub">Purchasing & Vendor</div>
          </div>
          <div class="win-step ${step5Class}">
            <div class="win-step-circle">5</div>
            <div class="win-step-title">Penerimaan QC</div>
            <div class="win-step-sub">Gudang & Selesai</div>
          </div>
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px; margin-bottom:16px;">
        <div><strong>No. Dokumen:</strong> <span class="code-badge">${pr.pr_number}</span></div>
        <div><strong>Tanggal Permohonan:</strong> ${pr.request_date}</div>
        <div><strong>Pemohon:</strong> ${pr.requestor_name} (${pr.department_name})</div>
        <div><strong>Target Kedatangan:</strong> ${pr.required_date}</div>
        <div><strong>Status Alur Saat Ini:</strong> ${getStatusBadge(pr.status)}</div>
        <div><strong>Posisi Penanganan:</strong> ${pr.current_approval_level ? `Level ${pr.current_approval_level}` : (pr.final_approver_name || 'Gudang')}</div>
      </div>

      <!-- Table of items with comparison -->
      <div class="win-table-wrap">
        <div class="win-table-header"><span class="win-table-title">Daftar Barang & Komparasi Stok Rak vs Kebutuhan Beli</span></div>
        <table class="win-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Barang & Spek</th>
              <th style="width:70px;">Minta</th>
              <th style="width:80px;">Stok Gudang</th>
              <th style="width:70px;">Qty Beli</th>
              <th style="width:120px;">Harga Satuan</th>
              <th style="width:120px;">Subtotal Belanja</th>
            </tr>
          </thead>
          <tbody>
            ${pr.items.map((it, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${it.item_name}</strong>
                  <div style="font-size:11px; color:#64748b;">${it.specification || '-'}</div>
                </td>
                <td style="text-align:center; font-weight:600;">${it.qty_requested} ${it.unit}</td>
                <td style="text-align:center; color:#b45309; font-weight:700;">${it.warehouse_stock_qty || 0}</td>
                <td style="text-align:center; color:#dc2626; font-weight:700;">${it.qty_to_buy !== undefined ? it.qty_to_buy : it.qty_requested}</td>
                <td style="font-family:var(--font-mono);">Rp ${it.estimated_unit_price.toLocaleString('id-ID')}</td>
                <td style="font-family:var(--font-mono); font-weight:700;">Rp ${(it.qty_to_buy !== undefined ? (it.qty_to_buy * it.estimated_unit_price) : it.total_estimated_price).toLocaleString('id-ID')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${pr.linkedPO ? `
        <div class="win-card" style="background:#f5f3ff; border-color:#ddd6fe; margin-top:12px;">
          <strong>🔗 Dokumen Purchase Order Terkait:</strong> <span class="code-badge">${pr.linkedPO.po_number}</span> &bull; Vendor: <strong>${pr.linkedPO.vendor_name}</strong> &bull; Total: <strong>Rp ${pr.linkedPO.grand_total.toLocaleString('id-ID')}</strong> (${pr.linkedPO.status})
        </div>
      ` : ''}

      ${pr.linkedGR ? `
        <div class="win-card" style="background:#ecfdf5; border-color:#a7f3d0; margin-top:8px;">
          <strong>📦 Tiket Goods Receipt Penerimaan Gudang:</strong> <span class="code-badge">${pr.linkedGR.receipt_number}</span> &bull; Status: <strong>${pr.linkedGR.status}</strong> &bull; DO: <strong>${pr.linkedGR.vendor_delivery_note_number || 'Menunggu Vendor'}</strong>
        </div>
      ` : ''}
    `;

    openModal('modalPRDetail');
  } catch (err) {
    showToast('Error', 'Gagal memuat detail PR.', 'danger');
  }
}

function printFromDetail() {
  if (state.selectedPR) {
    closeModal('modalPRDetail');
    showOfficialPrintModal(state.selectedPR.id, 'PR');
  }
}

// ============================================================================
// OFFICIAL PRINTABLE CORPORATE DOCUMENT GENERATOR (PRINT DIALOG Ctrl+P)
// ============================================================================

function showOfficialPrintModal(docId, type = 'PR') {
  let doc = null;
  if (type === 'PR') {
    doc = docId ? state.requests.find(r => r.id === docId) : state.requests[0];
  } else {
    doc = docId ? state.purchaseOrders.find(p => p.id === docId) : state.purchaseOrders[0];
  }

  if (!doc) {
    showToast('Informasi', 'Tidak ada dokumen yang dipilih untuk dicetak.', 'warning');
    return;
  }

  const container = document.getElementById('printableDocumentContent');

  if (type === 'PR') {
    const totalVal = doc.total_need_purchase_amount !== undefined ? doc.total_need_purchase_amount : doc.total_estimated_amount;
    container.innerHTML = `
      <div style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 style="font-size:18px; font-weight:800; text-transform:uppercase; margin:0;">PT FLOWREQUEST NUSANTARA PERSADA</h2>
          <p style="font-size:11px; margin:2px 0 0; color:#444;">Gedung Cyber Tower Lt. 12, Jl. H.R. Rasuna Said Kav. 8, Jakarta Selatan &bull; Telp: (021) 5290-8800</p>
        </div>
        <div style="text-align:right;">
          <h3 style="font-size:14px; font-weight:700; color:#005a9e; margin:0;">MEMO PERMOHONAN PENGADAAN BARANG (PR)</h3>
          <span style="font-family:monospace; font-size:12px; font-weight:700;">${doc.pr_number}</span>
        </div>
      </div>

      <table style="width:100%; font-size:12px; margin-bottom:16px;">
        <tr>
          <td style="width:18%; font-weight:600;">Tanggal Pengajuan</td>
          <td style="width:32%;">: ${doc.request_date}</td>
          <td style="width:18%; font-weight:600;">Departemen</td>
          <td style="width:32%;">: ${doc.department_name}</td>
        </tr>
        <tr>
          <td style="font-weight:600;">Nama Pemohon</td>
          <td>: ${doc.requestor_name}</td>
          <td style="font-weight:600;">Target Dibutuhkan</td>
          <td>: ${doc.required_date}</td>
        </tr>
        <tr>
          <td style="font-weight:600;">Tingkat Urgensi</td>
          <td>: [${doc.urgency}]</td>
          <td style="font-weight:600;">Status Dokumen</td>
          <td>: ${doc.status}</td>
        </tr>
        <tr>
          <td style="font-weight:600; vertical-align:top;">Keperluan</td>
          <td colspan="3">: ${doc.purpose}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:20px;">
        <thead>
          <tr style="background:#f1f5f9; border-top:1px solid #000; border-bottom:1px solid #000;">
            <th style="padding:6px; text-align:center; width:30px;">No</th>
            <th style="padding:6px; text-align:left;">Nama Barang & Spesifikasi Teknis</th>
            <th style="padding:6px; text-align:center; width:70px;">Minta</th>
            <th style="padding:6px; text-align:center; width:80px;">Stok Gudang</th>
            <th style="padding:6px; text-align:center; width:70px;">Qty Beli</th>
            <th style="padding:6px; text-align:right; width:120px;">Estimasi Satuan (Rp)</th>
            <th style="padding:6px; text-align:right; width:130px;">Total Estimasi (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${doc.items.map((it, idx) => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px; text-align:center;">${idx + 1}</td>
              <td style="padding:6px;"><strong>${it.item_name}</strong><br><small style="color:#555;">${it.specification || '-'}</small></td>
              <td style="padding:6px; text-align:center;">${it.qty_requested} ${it.unit}</td>
              <td style="padding:6px; text-align:center;">${it.warehouse_stock_qty || 0}</td>
              <td style="padding:6px; text-align:center; font-weight:700;">${it.qty_to_buy !== undefined ? it.qty_to_buy : it.qty_requested}</td>
              <td style="padding:6px; text-align:right; font-family:monospace;">Rp ${it.estimated_unit_price.toLocaleString('id-ID')}</td>
              <td style="padding:6px; text-align:right; font-family:monospace; font-weight:700;">Rp ${(it.qty_to_buy !== undefined ? (it.qty_to_buy * it.estimated_unit_price) : it.total_estimated_price).toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:1px solid #000; border-bottom:2px solid #000; font-weight:700;">
            <td colspan="6" style="padding:8px; text-align:right;">TOTAL BELANJA PENGADAAN (IDR):</td>
            <td style="padding:8px; text-align:right; font-family:monospace; font-size:13px; color:#005a9e;">Rp ${totalVal.toLocaleString('id-ID')}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 4 Column Signature Box -->
      <table style="width:100%; font-size:11px; text-align:center; margin-top:30px;">
        <tr>
          <td style="width:25%;">Diajukan Oleh,<br><br><br><br><strong><u>${doc.requestor_name}</u></strong><br>Staff Pemohon</td>
          <td style="width:25%;">Diverifikasi Fisik,<br><br><br><br><strong><u>Joko Susilo</u></strong><br>Kepala Gudang</td>
          <td style="width:25%;">Disetujui Otorisasi,<br><br><br><br><strong><u>${doc.final_approver_name || 'Ir. Bambang Hartono'}</u></strong><br>Pimpinan Otorisasi</td>
          <td style="width:25%;">Diproses Pengadaan,<br><br><br><br><strong><u>Maya Sartika</u></strong><br>Bagian Purchasing</td>
        </tr>
      </table>
    `;
  } else {
    // Purchase Order Print Format
    container.innerHTML = `
      <div style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 style="font-size:18px; font-weight:800; text-transform:uppercase; margin:0;">PT FLOWREQUEST NUSANTARA PERSADA</h2>
          <p style="font-size:11px; margin:2px 0 0; color:#444;">Gedung Cyber Tower Lt. 12, Jl. H.R. Rasuna Said Kav. 8, Jakarta Selatan &bull; Telp: (021) 5290-8800</p>
        </div>
        <div style="text-align:right;">
          <h3 style="font-size:15px; font-weight:700; color:#5c2d91; margin:0;">SURAT PESANAN RESMI (PURCHASE ORDER)</h3>
          <span style="font-family:monospace; font-size:12px; font-weight:700;">${doc.po_number}</span>
        </div>
      </div>

      <table style="width:100%; font-size:12px; margin-bottom:16px;">
        <tr>
          <td style="width:18%; font-weight:600;">Tanggal PO</td>
          <td style="width:32%;">: ${doc.po_date}</td>
          <td style="width:18%; font-weight:600;">Vendor Rekanan</td>
          <td style="width:32%;">: <strong>${doc.vendor_name}</strong></td>
        </tr>
        <tr>
          <td style="font-weight:600;">No. PR Acuan</td>
          <td>: ${doc.pr_number}</td>
          <td style="font-weight:600;">Termin Pembayaran</td>
          <td>: ${doc.payment_terms}</td>
        </tr>
        <tr>
          <td style="font-weight:600;">Target Kirim</td>
          <td>: ${doc.delivery_date || '-'}</td>
          <td style="font-weight:600;">Status Otorisasi</td>
          <td>: ${doc.status}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:20px;">
        <thead>
          <tr style="background:#f1f5f9; border-top:1px solid #000; border-bottom:1px solid #000;">
            <th style="padding:6px; text-align:center; width:30px;">#</th>
            <th style="padding:6px; text-align:left;">Uraian Barang & Spesifikasi Vendor</th>
            <th style="padding:6px; text-align:center; width:70px;">Qty</th>
            <th style="padding:6px; text-align:right; width:130px;">Harga Satuan (Rp)</th>
            <th style="padding:6px; text-align:right; width:140px;">Total (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${doc.items.map((it, idx) => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px; text-align:center;">${idx + 1}</td>
              <td style="padding:6px;"><strong>${it.item_name}</strong><br><small style="color:#555;">${it.specification || '-'}</small></td>
              <td style="padding:6px; text-align:center; font-weight:700;">${it.qty} ${it.unit}</td>
              <td style="padding:6px; text-align:right; font-family:monospace;">Rp ${it.unit_price.toLocaleString('id-ID')}</td>
              <td style="padding:6px; text-align:right; font-family:monospace; font-weight:700;">Rp ${it.total_price.toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:1px solid #000;">
            <td colspan="4" style="padding:5px 8px; text-align:right;">Subtotal:</td>
            <td style="padding:5px 8px; text-align:right; font-family:monospace;">Rp ${doc.subtotal.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:5px 8px; text-align:right;">PPN (11%):</td>
            <td style="padding:5px 8px; text-align:right; font-family:monospace;">Rp ${doc.tax_amount.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="border-bottom:2px solid #000; font-weight:700; font-size:13px; color:#5c2d91;">
            <td colspan="4" style="padding:6px 8px; text-align:right;">GRAND TOTAL PO:</td>
            <td style="padding:6px 8px; text-align:right; font-family:monospace;">Rp ${doc.grand_total.toLocaleString('id-ID')}</td>
          </tr>
        </tfoot>
      </table>

      <!-- PO Signatures -->
      <table style="width:100%; font-size:11px; text-align:center; margin-top:30px;">
        <tr>
          <td style="width:33%;">Dibuat Oleh,<br><br><br><br><strong><u>Maya Sartika</u></strong><br>Staff Purchasing</td>
          <td style="width:33%;">Disetujui Otorisasi Minimal Lvl 6,<br><br><br><br><strong><u>${doc.approved_by_name || 'Ir. Bambang Hartono (Manager L6)'}</u></strong><br>Manajer Operasional / Direksi</td>
          <td style="width:33%;">Diterima & Dikonfirmasi Vendor,<br><br><br><br><strong><u>${doc.vendor_name}</u></strong><br>Tanda Tangan & Cap Rekanan</td>
        </tr>
      </table>
    `;
  }

  openModal('modalPrintDoc');
}

// ============================================================================
// MODAL CONTROLS & UTILITIES
// ============================================================================

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showToast(title, msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `win-toast ${type}`;
  toast.innerHTML = `
    <div>
      <div class="win-toast-title">${title}</div>
      <div class="win-toast-msg">${msg}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

async function resetDatabaseDemo() {
  if (!confirm('Apakah Anda yakin ingin me-reset seluruh database transaksi kembali ke kondisi awal demo?')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/reset-data`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast('Database Di-reset', json.message, 'success');
      await loadInitialState();
    }
  } catch (err) {
    showToast('Error', 'Gagal me-reset database.', 'danger');
  }
}

// Windows Titlebar Window Control Emulations
function minimizeWindow() {
  showToast('Jendela Diminimalkan', 'Aplikasi FlowRequest Pro berjalan di taskbar Windows.', 'info');
}

function toggleMaximizeWindow() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    showToast('Mode Layar Penuh', 'Aplikasi dimaksimalkan.', 'info');
  } else {
    document.exitFullscreen().catch(() => {});
    showToast('Mode Jendela', 'Ukuran jendela dipulihkan.', 'info');
  }
}

function closeWindow() {
  if (confirm('Tutup aplikasi FlowRequest Pro?')) {
    window.close();
  }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Escape closes modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.win-modal-backdrop').forEach(m => m.style.display = 'none');
    }
    // Ctrl+N for new PR
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      switchView('create-pr');
    }
    // Ctrl+P for Print
    if (e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      showOfficialPrintModal(null, 'PR');
    }
  });
}

import { PRStatus, RoleCode } from '../types';

export interface PRItemInput {
  item_name: string;
  specification?: string;
  qty_requested: number;
  unit: string;
  estimated_unit_price: number;
}

export interface GudangVerificationItem {
  request_item_id: number;
  warehouse_stock_qty: number;
  qty_to_buy: number;
  warehouse_notes?: string;
}

export class PRWorkflowService {
  /**
   * FASE 1 - LANGKAH 1: Petugas membuat dan mengajukan PR
   */
  public async submitPR(requestorUser: any, prData: { purpose: string; items: PRItemInput[] }) {
    // 1. Validasi: User harus berstatus Petugas / Requestor (Level 1)
    if (requestorUser.role_level !== 1) {
      throw new Error('Hanya Petugas (Requestor) yang berwenang membuat permohonan barang.');
    }

    // 2. Generate nomor PR otomatis (misal: PR/2026/10/0001)
    const prNumber = `PR-${Date.now()}`;

    // 3. Hitung estimasi awal
    let totalEstimated = 0;
    const items = prData.items.map((item) => {
      const lineTotal = item.qty_requested * item.estimated_unit_price;
      totalEstimated += lineTotal;
      return {
        ...item,
        total_estimated_price: lineTotal,
        qty_to_buy: item.qty_requested, // Default sebelum dicek gudang
        warehouse_stock_qty: 0
      };
    });

    // 4. Simpan ke database dengan status SUBMITTED_TO_GUDANG
    const prRecord = {
      pr_number: prNumber,
      requestor_id: requestorUser.id,
      department_id: requestorUser.department_id,
      purpose: prData.purpose,
      status: PRStatus.SUBMITTED_TO_GUDANG,
      total_estimated_amount: totalEstimated,
      current_approval_level: null,
      items
    };

    // 5. Catat ke approval_logs (ACTION: 'SUBMITTED_TO_GUDANG')
    return prRecord;
  }

  /**
   * FASE 1 - LANGKAH 2: Gudang mengecek ketersediaan stok
   */
  public async verifyStockByGudang(
    warehouseUser: any,
    requestId: number,
    verifications: GudangVerificationItem[]
  ) {
    // 1. Validasi role: User harus Gudang (Level 2)
    if (warehouseUser.role_code !== RoleCode.GUDANG) {
      throw new Error('Otorisasi ditolak. Pengecekan stok hanya dapat dilakukan oleh staf Gudang.');
    }

    // 2. Ambil data PR dari database
    // const pr = await db.requests.findUnique({ where: { id: requestId }, include: { items: true } });
    // if (pr.status !== PRStatus.SUBMITTED_TO_GUDANG) throw new Error('PR tidak dalam status pengecekan gudang.');

    // 3. Update setiap item berdasarkan stok fisik
    let totalNeedPurchaseAmount = 0;
    let anyItemNeedsPurchase = false;

    // Simulasi iterasi verifikasi:
    for (const v of verifications) {
      if (v.qty_to_buy > 0) {
        anyItemNeedsPurchase = true;
        // totalNeedPurchaseAmount += v.qty_to_buy * item.estimated_unit_price;
      }
    }

    // 4. Percabangan status:
    // Kasus A: Seluruh barang sudah tersedia di gudang -> tidak perlu dibeli!
    if (!anyItemNeedsPurchase) {
      // PR langsung dipenuhi oleh gudang (Selesai tanpa approval berjenjang / PO)
      // UPDATE requests SET status = 'FULFILLED_BY_STOCK' WHERE id = requestId;
      return {
        status: PRStatus.FULFILLED_BY_STOCK,
        message: 'Semua barang tersedia di gudang. Permohonan langsung dipenuhi dari stok.'
      };
    }

    // Kasus B: Sebagian atau seluruh barang harus dibeli
    // PR masuk ke alur approval berjenjang, dimulai dari Supervisor (Level 3)
    // UPDATE requests SET
    //   status = 'PENDING_APPROVAL',
    //   total_estimated_amount = totalNeedPurchaseAmount,
    //   current_approval_level = 3
    // WHERE id = requestId;

    return {
      status: PRStatus.PENDING_APPROVAL,
      current_approval_level: 3,
      message: 'Stok tidak mencukupi. PR dialihkan ke alur persetujuan berjenjang (Supervisor).'
    };
  }

  /**
   * FASE 1 - LANGKAH 3: Dynamic Threshold Routing Approval (Level 3 s/d 8)
   */
  public async approvePR(approverUser: any, requestId: number, notes?: string) {
    // 1. Role approver harus dalam rentang Level 3 - 8
    const approverLevel = approverUser.role_level;
    if (approverLevel < 3 || approverLevel > 8) {
      throw new Error('User ini tidak memiliki wewenang untuk menyetujui PR.');
    }

    // 2. Ambil data PR
    // const pr = await db.requests.findById(requestId);
    const mockPR = {
      id: requestId,
      status: PRStatus.PENDING_APPROVAL,
      current_approval_level: 3,
      total_estimated_amount: 15000000.00 // Rp 15.000.000
    };

    if (mockPR.status !== PRStatus.PENDING_APPROVAL) {
      throw new Error('Dokumen PR tidak sedang menunggu persetujuan.');
    }

    // 3. Validasi giliran level approval
    if (mockPR.current_approval_level !== approverLevel) {
      throw new Error(
        `Belum giliran Anda. Menunggu persetujuan dari Level ${mockPR.current_approval_level}.`
      );
    }

    // 4. Ambil batas maksimal persetujuan (Threshold) untuk role approver ini
    // const limit = await db.approval_limits.findOne({ where: { role_id: approverUser.role_id, is_active: true } });
    const mockApproverLimit = {
      level: approverLevel,
      max_amount: 5000000.00 // Misal Supervisor max 5 juta
    };

    // 5. Evaluasi Dynamic Threshold:
    if (mockPR.total_estimated_amount <= mockApproverLimit.max_amount || approverLevel === 8) {
      // Nominal berada di bawah/sama dengan batas wewenang role ini, ATAU sudah Direktur Utama (Level 8)
      // PR RESMI DISETUJUI SECARA FINAL
      // UPDATE requests SET status = 'APPROVED', current_approval_level = NULL, final_approver_id = approverUser.id, approved_at = NOW();
      return {
        status: PRStatus.APPROVED,
        is_final: true,
        message: 'PR berhasil disetujui secara final. Dokumen siap diteruskan ke Purchasing.'
      };
    } else {
      // Nominal melebihi wewenang role ini -> Eskalasi otomatis ke level berikutnya!
      const nextLevel = approverLevel + 1;
      // UPDATE requests SET current_approval_level = nextLevel;
      return {
        status: PRStatus.PENDING_APPROVAL,
        current_approval_level: nextLevel,
        is_final: false,
        message: `Nominal (Rp ${mockPR.total_estimated_amount.toLocaleString()}) melebihi limit Level ${approverLevel}. Dokumen dieskalasi ke Level ${nextLevel}.`
      };
    }
  }

  /**
   * Tolak PR (Dapat dilakukan oleh approver yang sedang aktif)
   */
  public async rejectPR(approverUser: any, requestId: number, reason: string) {
    if (!reason) throw new Error('Alasan penolakan wajib disertakan.');
    // UPDATE requests SET status = 'REJECTED', rejection_reason = reason WHERE id = requestId;
    return {
      status: PRStatus.REJECTED,
      message: 'PR telah ditolak.'
    };
  }
}

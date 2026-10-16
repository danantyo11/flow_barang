import { GoodsReceiptStatus, POStatus, PRStatus, RoleCode } from '../types';

export interface POItemInput {
  request_item_id: number;
  item_name: string;
  specification?: string;
  qty: number;
  unit: string;
  unit_price: number;
}

export class POWorkflowService {
  /**
   * FASE 2 - LANGKAH 1: Purchasing membuat Draft PO dari PR yang sudah disetujui
   */
  public async createDraftPO(
    purchasingUser: any,
    payload: {
      request_id: number;
      vendor_id: number;
      delivery_date?: string;
      payment_terms?: string;
      tax_rate?: number;
      items: POItemInput[];
    }
  ) {
    // 1. Validasi: User harus Purchasing
    if (purchasingUser.role_code !== RoleCode.PURCHASING) {
      throw new Error('Hanya bagian Purchasing yang berwenang membuat Purchase Order.');
    }

    // 2. Validasi status PR sumber: Harus APPROVED
    // const pr = await db.requests.findById(payload.request_id);
    // if (pr.status !== PRStatus.APPROVED) {
    //   throw new Error('Hanya PR berstatus APPROVED yang dapat diproses menjadi PO.');
    // }

    // 3. Hitung subtotal, tax, grand total
    let subtotal = 0;
    const poItems = payload.items.map((item) => {
      const lineTotal = item.qty * item.unit_price;
      subtotal += lineTotal;
      return {
        ...item,
        total_price: lineTotal
      };
    });

    const taxRate = payload.tax_rate ?? 11.0; // Default PPN 11%
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    const poNumber = `PO-${Date.now()}`;

    // 4. Buat record PO dengan status DRAFT_PO
    const poRecord = {
      po_number: poNumber,
      request_id: payload.request_id,
      purchasing_user_id: purchasingUser.id,
      vendor_id: payload.vendor_id,
      po_date: new Date().toISOString().slice(0, 10),
      delivery_date: payload.delivery_date,
      payment_terms: payload.payment_terms || 'Net 30 Days',
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      status: POStatus.DRAFT_PO,
      items: poItems
    };

    // 5. Update status PR menjadi IN_PO_PROCESS
    // UPDATE requests SET status = 'IN_PO_PROCESS' WHERE id = payload.request_id;

    return poRecord;
  }

  /**
   * FASE 2 - LANGKAH 2: Purchasing mengajukan Draft PO untuk approval Manager ke atas
   */
  public async submitPOForApproval(purchasingUser: any, poId: number) {
    // 1. Validasi status saat ini harus DRAFT_PO
    // UPDATE purchase_orders SET status = 'WAITING_PO_APPROVAL' WHERE id = poId;
    return {
      po_id: poId,
      status: POStatus.WAITING_PO_APPROVAL,
      message: 'Draft PO berhasil diajukan untuk persetujuan Manajemen (Minimal Manager Level 6).'
    };
  }

  /**
   * FASE 2 - LANGKAH 3: Approval PO oleh Manager ke atas (Level >= 6)
   * CORE REQUIREMENT: PO yang dibuat Purchasing hanya bisa di-approve minimal Level 6 (Manager, Direktur, Dirut)
   */
  public async approvePO(approverUser: any, poId: number, notes?: string) {
    const approverLevel = approverUser.role_level;

    // VALIDASI EKSKLUSIF LEVEL PO APPROVAL:
    if (approverLevel < 6) {
      throw new Error(
        `Pelanggaran Otoritas: Approval PO mewajibkan peran minimal Manager (Level 6). Peran Anda saat ini adalah Level ${approverLevel}.`
      );
    }

    // Ambil data PO
    // const po = await db.purchase_orders.findById(poId);
    // if (po.status !== POStatus.WAITING_PO_APPROVAL) {
    //   throw new Error('Status PO tidak dalam posisi menunggu persetujuan.');
    // }

    // Update status PO menjadi APPROVED
    // UPDATE purchase_orders SET
    //   status = 'APPROVED',
    //   approved_by_user_id = approverUser.id,
    //   approved_at = NOW(),
    //   po_approval_notes = notes
    // WHERE id = poId;

    return {
      po_id: poId,
      status: POStatus.APPROVED,
      approved_by: approverUser.full_name,
      approved_at: new Date().toISOString(),
      message: 'Purchase Order telah disetujui oleh Manajemen dan siap diterbitkan ke Vendor.'
    };
  }

  /**
   * FASE 2 - LANGKAH 4: Purchasing menerbitkan (Release) PO ke Vendor
   * SECARA OTOMATIS: Sistem menerbitkan tiket penerimaan barang (Goods Receipt) ke antrean User Gudang.
   */
  public async releasePOToVendor(purchasingUser: any, poId: number) {
    if (purchasingUser.role_code !== RoleCode.PURCHASING) {
      throw new Error('Hanya Purchasing yang dapat menerbitkan PO ke Vendor.');
    }

    // 1. Validasi PO status harus sudah APPROVED oleh Manager+ (Level >= 6)
    // const po = await db.purchase_orders.findById(poId, { include: { items: true } });
    // if (po.status !== POStatus.APPROVED) {
    //   throw new Error('PO belum disetujui oleh Manager/Direktur. Tidak dapat diterbitkan ke vendor.');
    // }

    // 2. Update status PO menjadi RELEASED_TO_VENDOR
    // UPDATE purchase_orders SET status = 'RELEASED_TO_VENDOR', released_at = NOW() WHERE id = poId;

    // 3. GENERATE OTOMATIS TIKET PENERIMAAN BARANG UNTUK USER GUDANG:
    const receiptNumber = `GR-${Date.now()}`;
    const initialGoodsReceipt = {
      receipt_number: receiptNumber,
      po_id: poId,
      status: GoodsReceiptStatus.WAITING_RECEIPT,
      receiving_notes: 'Menunggu kedatangan fisik barang dari vendor sesuai pesanan PO.'
    };

    // 4. Salin seluruh item PO ke antrean pemeriksaan fisik barang gudang:
    // INSERT INTO goods_receipts (receipt_number, po_id, status, receiving_notes) VALUES (...)
    // INSERT INTO goods_receipt_items (goods_receipt_id, po_item_id, qty_ordered, qty_received, qty_accepted, qty_rejected)
    // SELECT new_gr_id, id, qty, 0, 0, 0 FROM purchase_order_items WHERE po_id = poId;

    // 5. Catat audit log: PO telah dikirim ke vendor dan antrean penerimaan gudang dibuka
    // INSERT INTO approval_logs (document_type, document_id, actor_id, role_id, action, new_status, comments)
    // VALUES ('PO', poId, purchasingUser.id, purchasingUser.role_id, 'PO_RELEASED_AND_RECEIVING_CREATED', 'RELEASED_TO_VENDOR',
    //         'PO diterbitkan ke vendor. Tiket penerimaan otomatis masuk ke dashboard user Gudang.');

    return {
      po_id: poId,
      status: POStatus.RELEASED_TO_VENDOR,
      goods_receipt: {
        receipt_number: receiptNumber,
        status: GoodsReceiptStatus.WAITING_RECEIPT,
        assigned_to_role: RoleCode.GUDANG,
        description: 'Tiket penerimaan barang otomatis terbit dan siap diproses oleh user Gudang saat vendor tiba.'
      },
      message: 'PO resmi diterbitkan ke Vendor dan otomatis masuk ke antrean penerimaan User Gudang.'
    };
  }
}


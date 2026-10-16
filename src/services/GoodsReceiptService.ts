import { GoodsReceiptStatus, POStatus, PRStatus, RoleCode } from '../types';

export interface ReceiveItemInput {
  goods_receipt_item_id: number;
  qty_received: number;
  qty_accepted: number;
  qty_rejected: number;
  warehouse_bin_location?: string;
  item_condition_notes?: string;
}

export class GoodsReceiptService {
  /**
   * LANGKAH PENERIMAAN 1: User Gudang melihat daftar PO yang telah dikirim ke vendor
   * dan menunggu kedatangan fisik barang.
   */
  public async getIncomingReceiptList(warehouseUser: any) {
    if (warehouseUser.role_code !== RoleCode.GUDANG) {
      throw new Error('Hanya staf Gudang yang berwenang mengakses antrean penerimaan barang.');
    }

    // Query database:
    // SELECT gr.id, gr.receipt_number, gr.status, gr.created_at,
    //        po.po_number, po.po_date, v.name as vendor_name, v.phone as vendor_phone
    // FROM goods_receipts gr
    // JOIN purchase_orders po ON gr.po_id = po.id
    // JOIN vendors v ON po.vendor_id = v.id
    // WHERE gr.status IN ('WAITING_RECEIPT', 'PARTIALLY_RECEIVED')
    // ORDER BY gr.created_at DESC;

    return {
      message: 'Daftar barang masuk yang menunggu penerimaan fisik di gudang.',
      queue: []
    };
  }

  /**
   * LANGKAH PENERIMAAN 2: User Gudang memproses penerimaan fisik barang dari Vendor
   */
  public async processGoodsReceipt(
    warehouseUser: any,
    receiptId: number,
    payload: {
      vendor_delivery_note_number: string; // Nomor Surat Jalan dari kurir/vendor
      receiving_notes?: string;
      items: ReceiveItemInput[];
    }
  ) {
    if (warehouseUser.role_code !== RoleCode.GUDANG) {
      throw new Error('Hanya staf Gudang yang berwenang memvalidasi dan menerima fisik barang.');
    }

    if (!payload.vendor_delivery_note_number) {
      throw new Error('Nomor Surat Jalan / Delivery Order vendor wajib diisi.');
    }

    // 1. Ambil data Goods Receipt
    // const gr = await db.goods_receipts.findById(receiptId, { include: { items: true, po: true } });
    // if (!gr || gr.status === GoodsReceiptStatus.RECEIVED_COMPLETED) {
    //   throw new Error('Tiket penerimaan tidak valid atau sudah selesai diterima.');
    // }

    // 2. Evaluasi kuantitas yang diterima (QC Check)
    let isAllComplete = true;
    for (const item of payload.items) {
      if (item.qty_accepted < 0 || item.qty_rejected < 0) {
        throw new Error('Kuantitas barang tidak boleh negatif.');
      }

      // UPDATE goods_receipt_items SET
      //   qty_received = item.qty_received,
      //   qty_accepted = item.qty_accepted,
      //   qty_rejected = item.qty_rejected,
      //   warehouse_bin_location = item.warehouse_bin_location,
      //   item_condition_notes = item.item_condition_notes
      // WHERE id = item.goods_receipt_item_id;

      // Cek apakah kuantitas diterima memenuhi kuantitas pesanan:
      // if (item.qty_accepted < original_qty_ordered) isAllComplete = false;
    }

    const finalStatus = isAllComplete
      ? GoodsReceiptStatus.RECEIVED_COMPLETED
      : GoodsReceiptStatus.PARTIALLY_RECEIVED;

    // 3. Update status tiket Goods Receipt
    // UPDATE goods_receipts SET
    //   vendor_delivery_note_number = payload.vendor_delivery_note_number,
    //   warehouse_user_id = warehouseUser.id,
    //   received_date = NOW(),
    //   status = finalStatus,
    //   receiving_notes = payload.receiving_notes
    // WHERE id = receiptId;

    // 4. Jika penerimaan lengkap, tutup siklus PO & PR menjadi COMPLETED
    if (finalStatus === GoodsReceiptStatus.RECEIVED_COMPLETED) {
      // UPDATE purchase_orders SET status = 'COMPLETED' WHERE id = gr.po_id;
      // UPDATE requests SET status = 'COMPLETED' WHERE id = gr.po.request_id;
    }

    // 5. Catat audit trail
    // INSERT INTO approval_logs (document_type, document_id, actor_id, role_id, action, new_status, comments)
    // VALUES ('GOODS_RECEIPT', receiptId, warehouseUser.id, warehouseUser.role_id, 'GOODS_RECEIVED', finalStatus,
    //         `Barang diterima oleh gudang dengan Surat Jalan: ${payload.vendor_delivery_note_number}`);

    return {
      receipt_id: receiptId,
      status: finalStatus,
      processed_by: warehouseUser.full_name,
      delivery_note_number: payload.vendor_delivery_note_number,
      message: isAllComplete
        ? 'Seluruh barang PO berhasil diterima lengkap di gudang. Siklus pengadaan selesai.'
        : 'Barang diterima sebagian (parsial). Menunggu sisa pengiriman dari vendor.'
    };
  }
}

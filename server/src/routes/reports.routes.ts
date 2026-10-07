import { Router, Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/reports/:reportType?format=json|excel
router.get('/:reportType', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportType } = req.params;
    const format = (req.query.format as string) || 'json';

    let reportData: any[] = [];
    let title = 'Report';

    switch (reportType) {
      case 'pr':
      case 'purchase-requests': {
        title = 'Laporan Permintaan Barang (PR)';
        const prs = await prisma.purchaseRequest.findMany({
          include: { requester: true, department: true, items: true },
          orderBy: { createdAt: 'desc' },
        });
        reportData = prs.map((p) => ({
          'No PR': p.prNumber,
          'Tanggal': p.requestDate.toISOString().split('T')[0],
          'Pemohon': p.requester.name,
          'Departemen': p.department.departmentName,
          'Prioritas': p.priority,
          'Status': p.status,
          'Jumlah Item': p.items.length,
          'Keperluan': p.purpose || '-',
        }));
        break;
      }

      case 'po':
      case 'purchase-orders': {
        title = 'Laporan Purchase Order (PO)';
        const pos = await prisma.purchaseOrder.findMany({
          include: { supplier: true, items: true },
          orderBy: { createdAt: 'desc' },
        });
        reportData = pos.map((p) => ({
          'No PO': p.poNumber,
          'Tanggal PO': p.poDate.toISOString().split('T')[0],
          'Supplier': p.supplier.supplierName,
          'Subtotal': p.subtotal,
          'Diskon': p.discount,
          'Pajak': p.taxAmount,
          'Total Nilai': p.totalAmount,
          'Status': p.status,
          'Tipe': p.purchaseType,
        }));
        break;
      }

      case 'outstanding-po': {
        title = 'Laporan Outstanding PO';
        const pos = await prisma.purchaseOrder.findMany({
          where: { status: { in: ['SENT', 'PARTIALLY_RECEIVED', 'APPROVED'] } },
          include: { supplier: true, items: true },
          orderBy: { createdAt: 'desc' },
        });
        reportData = pos.map((p) => ({
          'No PO': p.poNumber,
          'Supplier': p.supplier.supplierName,
          'Tanggal PO': p.poDate.toISOString().split('T')[0],
          'Tenggat Pengiriman': p.deliveryDate ? p.deliveryDate.toISOString().split('T')[0] : '-',
          'Total Nilai': p.totalAmount,
          'Status': p.status,
        }));
        break;
      }

      case 'stock':
      case 'stock-summary': {
        title = 'Laporan Stok Barang';
        const items = await prisma.item.findMany({
          include: {
            category: true,
            unit: true,
            stockBalances: true,
          },
          orderBy: { itemCode: 'asc' },
        });
        reportData = items.map((it) => {
          const totalStock = it.stockBalances.reduce((sum, b) => sum + b.quantity, 0);
          let status = 'NORMAL';
          if (totalStock <= it.criticalStock) status = 'CRITICAL';
          else if (totalStock <= it.minimumStock) status = 'LOW_STOCK';

          return {
            'Kode Barang': it.itemCode,
            'Nama Barang': it.itemName,
            'Kategori': it.category.name,
            'Satuan': it.unit.name,
            'Total Stok': totalStock,
            'Min Stok': it.minimumStock,
            'Reorder Point': it.reorderPoint,
            'Critical Stok': it.criticalStock,
            'Status Stok': status,
            'Kritis': it.isCritical ? 'YA' : 'TIDAK',
          };
        });
        break;
      }

      case 'critical-stock': {
        title = 'Laporan Barang Kritis & Kebutuhan Reorder';
        const items = await prisma.item.findMany({
          include: { category: true, unit: true, stockBalances: true },
        });
        const criticalItems = items.filter((it) => {
          const totalStock = it.stockBalances.reduce((sum, b) => sum + b.quantity, 0);
          return totalStock <= it.criticalStock || totalStock <= it.minimumStock || it.isCritical;
        });
        reportData = criticalItems.map((it) => {
          const totalStock = it.stockBalances.reduce((sum, b) => sum + b.quantity, 0);
          return {
            'Kode Barang': it.itemCode,
            'Nama Barang': it.itemName,
            'Kategori': it.category.name,
            'Satuan': it.unit.name,
            'Stok Saat Ini': totalStock,
            'Critical Level': it.criticalStock,
            'Min Stok': it.minimumStock,
            'Reorder Point': it.reorderPoint,
            'Status': totalStock <= it.criticalStock ? 'CRITICAL' : 'LOW_STOCK',
          };
        });
        break;
      }

      case 'receiving': {
        title = 'Laporan Penerimaan Barang (GR)';
        const grs = await prisma.goodsReceipt.findMany({
          include: { purchaseOrder: true, supplier: true, items: true },
          orderBy: { createdAt: 'desc' },
        });
        reportData = grs.map((g) => ({
          'No GR': g.grNumber,
          'Tanggal': g.arrivalDate.toISOString().split('T')[0],
          'Penerima': g.receivedBy,
          'Supplier': g.supplier?.supplierName || '-',
          'No Surat Jalan': g.deliveryNoteNumber || '-',
          'Destinasi': g.destination,
          'Status QC': g.qcStatus,
        }));
        break;
      }

      case 'goods-issue': {
        title = 'Laporan Pengeluaran Barang (GI)';
        const gis = await prisma.goodsIssue.findMany({
          include: { requester: true, department: true, warehouse: true, items: true },
          orderBy: { createdAt: 'desc' },
        });
        reportData = gis.map((gi) => ({
          'No GI': gi.giNumber,
          'Tanggal': gi.issueDate.toISOString().split('T')[0],
          'Pemohon': gi.requester.name,
          'Departemen': gi.department.departmentName,
          'Gudang': gi.warehouse.warehouseName,
          'Jumlah Item': gi.items.length,
        }));
        break;
      }

      case 'handover': {
        title = 'Laporan Serah Terima Barang (HO)';
        const hos = await prisma.handoverDocument.findMany({
          include: { requester: true, department: true },
          orderBy: { createdAt: 'desc' },
        });
        reportData = hos.map((h) => ({
          'No HO': h.hoNumber,
          'Tanggal': h.handoverDate.toISOString().split('T')[0],
          'Pemohon': h.requester.name,
          'Departemen': h.department.departmentName,
          'Penerima': h.receiverName,
          'Status': h.status,
          'Catatan Konfirmasi': h.receiverSignatureNote || '-',
        }));
        break;
      }

      default: {
        return res.status(400).json({ success: false, message: 'Jenis laporan tidak dikenali' });
      }
    }

    if (format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    return res.json({
      success: true,
      title,
      reportType,
      count: reportData.length,
      data: reportData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

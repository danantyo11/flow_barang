import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/search?q=query
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const [prs, pos, grs, gis, items, suppliers] = await Promise.all([
      // Search PRs
      prisma.purchaseRequest.findMany({
        where: {
          OR: [
            { prNumber: { contains: q } },
            { purpose: { contains: q } },
            { requester: { name: { contains: q } } },
          ],
        },
        include: { requester: true, department: true },
        take: 5,
      }),

      // Search POs
      prisma.purchaseOrder.findMany({
        where: {
          OR: [
            { poNumber: { contains: q } },
            { supplier: { supplierName: { contains: q } } },
          ],
        },
        include: { supplier: true },
        take: 5,
      }),

      // Search GRs
      prisma.goodsReceipt.findMany({
        where: {
          OR: [
            { grNumber: { contains: q } },
            { deliveryNoteNumber: { contains: q } },
            { receivedBy: { contains: q } },
          ],
        },
        take: 5,
      }),

      // Search GIs
      prisma.goodsIssue.findMany({
        where: {
          OR: [
            { giNumber: { contains: q } },
            { requester: { name: { contains: q } } },
          ],
        },
        include: { requester: true },
        take: 5,
      }),

      // Search Items
      prisma.item.findMany({
        where: {
          OR: [
            { itemCode: { contains: q } },
            { itemName: { contains: q } },
            { specification: { contains: q } },
          ],
        },
        include: { category: true, unit: true },
        take: 5,
      }),

      // Search Suppliers
      prisma.supplier.findMany({
        where: {
          OR: [
            { supplierCode: { contains: q } },
            { supplierName: { contains: q } },
            { contactPerson: { contains: q } },
          ],
        },
        take: 5,
      }),
    ]);

    const results = [
      ...prs.map((p) => ({
        type: 'PR',
        id: p.id,
        title: p.prNumber,
        subtitle: `${p.requester.name} (${p.department.departmentName}) - ${p.status}`,
        link: `/purchase-requests/${p.id}`,
      })),
      ...pos.map((p) => ({
        type: 'PO',
        id: p.id,
        title: p.poNumber,
        subtitle: `${p.supplier.supplierName} - ${p.status}`,
        link: `/purchase-orders/${p.id}`,
      })),
      ...grs.map((g) => ({
        type: 'GR',
        id: g.id,
        title: g.grNumber,
        subtitle: `Diterima: ${g.receivedBy} - QC: ${g.qcStatus}`,
        link: `/goods-receipts/${g.id}`,
      })),
      ...gis.map((gi) => ({
        type: 'GI',
        id: gi.id,
        title: gi.giNumber,
        subtitle: `Pengeluaran ke ${gi.requester.name}`,
        link: `/goods-issues`,
      })),
      ...items.map((it) => ({
        type: 'BARANG',
        id: it.id,
        title: `${it.itemCode} - ${it.itemName}`,
        subtitle: `${it.category.name} | Satuan: ${it.unit.name}`,
        link: `/items/${it.id}`,
      })),
      ...suppliers.map((s) => ({
        type: 'SUPPLIER',
        id: s.id,
        title: `${s.supplierCode} - ${s.supplierName}`,
        subtitle: `Kontak: ${s.contactPerson || '-'} | ${s.phone || '-'}`,
        link: `/suppliers`,
      })),
    ];

    return res.json({ success: true, count: results.length, results });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateDocumentNumber } from '../utils/documentNumber.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/purchase-requests
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, priority, departmentId } = req.query;
    const user = req.user!;

    const where: any = {};
    if (status) where.status = String(status);
    if (priority) where.priority = String(priority);
    if (departmentId) where.departmentId = String(departmentId);

    // If requester, can restrict or prioritize their department or PRs
    if (user.roleName === 'REQUESTER') {
      where.requesterId = user.id;
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, employeeNumber: true, email: true } },
        department: true,
        items: {
          include: {
            item: {
              include: {
                unit: true,
                category: true,
                stockBalances: true,
              },
            },
            unit: true,
          },
        },
        quotations: { include: { supplier: true } },
        purchaseOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: prs });
  } catch (error) {
    next(error);
  }
});

// GET /api/purchase-requests/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: req.params.id as string },
      include: {
        requester: { select: { id: true, name: true, employeeNumber: true, email: true, phone: true } },
        department: true,
        items: {
          include: {
            item: {
              include: {
                unit: true,
                category: true,
                stockBalances: {
                  include: { warehouse: true, location: true },
                },
              },
            },
            unit: true,
          },
        },
        quotations: {
          include: {
            supplier: true,
            items: true,
          },
        },
        purchaseOrders: {
          include: {
            supplier: true,
            items: true,
          },
        },
        goodsIssues: true,
        handovers: true,
      },
    });

    if (!pr) {
      return res.status(404).json({ success: false, message: 'Permintaan barang tidak ditemukan' });
    }

    return res.json({ success: true, data: pr });
  } catch (error) {
    next(error);
  }
});

const createPrSchema = z.object({
  departmentId: z.string().optional(),
  requiredDate: z.string().optional().nullable(),
  priority: z.enum(['NORMAL', 'URGENT', 'CRITICAL']).default('NORMAL'),
  purpose: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isDraft: z.boolean().default(false),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      specification: z.string().optional().nullable(),
      requestedQty: z.number().min(0.01),
      unitId: z.string().min(1),
      estimatedPrice: z.number().min(0).default(0),
      notes: z.string().optional().nullable(),
    })
  ).min(1, 'PR harus memiliki minimal 1 barang'),
});

// POST /api/purchase-requests - Create PR (Draft or Submitted)
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'REQUESTER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createPrSchema.parse(req.body);
      const user = req.user!;

      const deptId = data.departmentId || user.departmentId;
      if (!deptId) {
        return res.status(400).json({ success: false, message: 'Departemen pemohon harus ditentukan' });
      }

      const initialStatus = data.isDraft ? 'DRAFT' : 'WAITING_WAREHOUSE_CHECK';

      // Atomic sequential PR number
      const prNumber = await generateDocumentNumber(prisma, 'PR');

      const pr = await prisma.purchaseRequest.create({
        data: {
          prNumber,
          requesterId: user.id,
          departmentId: deptId,
          requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
          priority: data.priority,
          purpose: data.purpose,
          notes: data.notes,
          status: initialStatus,
          items: {
            create: data.items.map((it) => ({
              itemId: it.itemId,
              specification: it.specification,
              requestedQty: it.requestedQty,
              unitId: it.unitId,
              estimatedPrice: it.estimatedPrice,
              purchaseQty: it.requestedQty, // Initially assumes full purchase until warehouse check
              notes: it.notes,
            })),
          },
        },
        include: { items: true, department: true },
      });

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: data.isDraft ? 'CREATE_PR_DRAFT' : 'SUBMIT_PR',
        module: 'PR',
        documentNumber: pr.prNumber,
        newValue: pr,
        ipAddress: req.ip,
      });

      if (!data.isDraft) {
        // Notify Warehouse team
        await NotificationService.notify(prisma, {
          roleName: 'WAREHOUSE',
          title: 'Permintaan Barang Baru',
          message: `${pr.prNumber} (${user.name}) membutuhkan pemeriksaan stok gudang.`,
          link: `/warehouse-check/${pr.id}`,
        });
      }

      return res.status(201).json({
        success: true,
        message: data.isDraft ? 'Draft PR berhasil disimpan' : 'PR berhasil diajukan untuk pemeriksaan gudang',
        data: pr,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/purchase-requests/:id/submit - Submit Draft PR
router.post(
  '/:id/submit',
  authenticate,
  requireRole(['ADMIN', 'REQUESTER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pr = await prisma.purchaseRequest.findUnique({
        where: { id: req.params.id as string },
        include: { items: true },
      });

      if (!pr) return res.status(404).json({ success: false, message: 'PR tidak ditemukan' });
      if (pr.status !== 'DRAFT') {
        return res.status(400).json({ success: false, message: 'Hanya PR berstatus DRAFT yang dapat disubmit' });
      }
      if (pr.items.length === 0) {
        return res.status(400).json({ success: false, message: 'PR tidak dapat disubmit tanpa item barang' });
      }

      const updated = await prisma.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: 'WAITING_WAREHOUSE_CHECK' },
      });

      await NotificationService.notify(prisma, {
        roleName: 'WAREHOUSE',
        title: 'Pemeriksaan Stok Gudang Diperlukan',
        message: `${pr.prNumber} menunggu stock checking.`,
        link: `/warehouse-check/${pr.id}`,
      });

      return res.json({ success: true, message: 'PR berhasil disubmit ke Gudang', data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/purchase-requests/:id/cancel - Cancel PR before processed
router.post(
  '/:id/cancel',
  authenticate,
  requireRole(['ADMIN', 'REQUESTER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pr = await prisma.purchaseRequest.findUnique({ where: { id: req.params.id as string } });
      if (!pr) return res.status(404).json({ success: false, message: 'PR tidak ditemukan' });

      if (!['DRAFT', 'SUBMITTED', 'WAITING_WAREHOUSE_CHECK'].includes(pr.status)) {
        return res.status(400).json({
          success: false,
          message: 'PR yang sudah diproses atau disetujui tidak dapat dibatalkan langsung.',
        });
      }

      const updated = await prisma.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: 'CANCELLED' },
      });

      return res.json({ success: true, message: 'PR berhasil dibatalkan', data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/purchase-requests/:id/warehouse-check - Warehouse stock check workflow (Sections 9 & 10)
const warehouseCheckSchema = z.object({
  items: z.array(
    z.object({
      prItemId: z.string().min(1),
      availableStock: z.number().min(0),
      allocatedQty: z.number().min(0),
      purchaseQty: z.number().min(0),
      notes: z.string().optional().nullable(),
    })
  ).min(1),
  notes: z.string().optional().nullable(),
});

router.post(
  '/:id/warehouse-check',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items, notes } = warehouseCheckSchema.parse(req.body);
      const prId = req.params.id as string;

      const pr = await prisma.purchaseRequest.findUnique({
        where: { id: prId },
        include: { items: true, requester: true },
      });

      if (!pr) return res.status(404).json({ success: false, message: 'PR tidak ditemukan' });

      let totalAllocated = 0;
      let totalPurchase = 0;

      // Update PR detail items with checked stock allocations
      for (const itemCheck of items) {
        await prisma.purchaseRequestItem.update({
          where: { id: itemCheck.prItemId },
          data: {
            availableStock: itemCheck.availableStock,
            allocatedQty: itemCheck.allocatedQty,
            purchaseQty: itemCheck.purchaseQty,
            notes: itemCheck.notes,
            status: itemCheck.purchaseQty > 0 ? 'PURCHASING' : 'ALLOCATED',
          },
        });
        totalAllocated += itemCheck.allocatedQty;
        totalPurchase += itemCheck.purchaseQty;
      }

      // Determine PR status based on stock availability:
      // Case 1: All items available from stock -> STOCK_ISSUE (or READY_FOR_ISSUE)
      // Case 2: Partial stock available -> PARTIAL_STOCK (warehouse issues partial stock, remaining goes to purchasing)
      // Case 3: No stock available -> WAITING_PRICE (all to purchasing)
      let newPrStatus = 'PROCUREMENT';

      if (totalPurchase === 0 && totalAllocated > 0) {
        newPrStatus = 'STOCK_ISSUE';
      } else if (totalAllocated > 0 && totalPurchase > 0) {
        newPrStatus = 'PARTIAL_STOCK';
      } else {
        newPrStatus = 'WAITING_PRICE';
      }

      const updatedPR = await prisma.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: newPrStatus,
          notes: notes ? `${pr.notes ? pr.notes + ' | ' : ''}Catatan Gudang: ${notes}` : pr.notes,
        },
        include: { items: true },
      });

      await AuditService.log(prisma, {
        userId: req.user?.id,
        userName: req.user?.name || 'Warehouse Staff',
        action: 'WAREHOUSE_CHECK',
        module: 'WAREHOUSE',
        documentNumber: pr.prNumber,
        newValue: { totalAllocated, totalPurchase, newPrStatus },
        ipAddress: req.ip,
      });

      // Dispatch appropriate notifications
      if (totalPurchase > 0) {
        await NotificationService.notify(prisma, {
          roleName: 'PURCHASING',
          title: 'Permintaan Pembelian Baru',
          message: `${pr.prNumber} memiliki ${totalPurchase} item yang perlu dibeli/sourcing.`,
          link: `/purchasing?prId=${pr.id}`,
        });
      }

      await NotificationService.notify(prisma, {
        userId: pr.requesterId,
        title: 'Update Pemeriksaan Gudang',
        message: `PR ${pr.prNumber} telah diperiksa gudang. Status: ${newPrStatus}.`,
        link: `/purchase-requests/${pr.id}`,
      });

      return res.json({
        success: true,
        message: 'Hasil pemeriksaan stok gudang berhasil disimpan',
        data: updatedPR,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateDocumentNumber } from '../utils/documentNumber.js';
import { StockEngine } from '../services/stockEngine.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/goods-issues
router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const issues = await prisma.goodsIssue.findMany({
      include: {
        requester: true,
        department: true,
        warehouse: true,
        purchaseRequest: true,
        items: {
          include: {
            item: { include: { unit: true } },
            location: true,
            unit: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: issues });
  } catch (error) {
    next(error);
  }
});

const createGiSchema = z.object({
  prId: z.string().optional().nullable(),
  requesterId: z.string().min(1),
  departmentId: z.string().min(1),
  warehouseId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      locationId: z.string().optional().nullable(),
      quantity: z.number().min(0.01),
      unitId: z.string().min(1),
      notes: z.string().optional().nullable(),
    })
  ).min(1, 'Pengeluaran barang harus memiliki minimal 1 item'),
});

// POST /api/goods-issues - Process Stock Issue
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createGiSchema.parse(req.body);
      const user = req.user!;

      const giNumber = await generateDocumentNumber(prisma, 'GI');

      // Create Goods Issue Document
      const gi = await prisma.goodsIssue.create({
        data: {
          giNumber,
          prId: data.prId,
          requesterId: data.requesterId,
          departmentId: data.departmentId,
          warehouseId: data.warehouseId,
          createdBy: user.name,
          notes: data.notes,
          items: {
            create: data.items.map((it) => ({
              itemId: it.itemId,
              locationId: it.locationId,
              quantity: it.quantity,
              unitId: it.unitId,
              notes: it.notes,
            })),
          },
        },
        include: { items: true },
      });

      // Deduct stock for each item using StockEngine
      for (const item of data.items) {
        await StockEngine.recordMovement(prisma, {
          transactionType: 'ISSUE',
          itemId: item.itemId,
          warehouseId: data.warehouseId,
          locationId: item.locationId,
          referenceType: 'GI',
          referenceId: gi.giNumber,
          quantity: item.quantity,
          notes: `Pengeluaran barang nomor ${gi.giNumber}`,
          userId: user.id,
        });
      }

      // If associated with a PR, update PR status
      if (data.prId) {
        await prisma.purchaseRequest.update({
          where: { id: data.prId },
          data: { status: 'WAITING_HANDOVER' },
        });

        await NotificationService.notify(prisma, {
          userId: data.requesterId,
          title: 'Barang Telah Dikeluarkan dari Gudang',
          message: `${gi.giNumber} telah dikeluarkan dari gudang. Silakan lakukan konfirmasi serah terima.`,
          link: `/handovers`,
        });
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'GOODS_ISSUE',
        module: 'WAREHOUSE',
        documentNumber: gi.giNumber,
        newValue: { warehouseId: data.warehouseId, itemsCount: data.items.length },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        success: true,
        message: 'Pengeluaran barang dari stok gudang berhasil diproses',
        data: gi,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

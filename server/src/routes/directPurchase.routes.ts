import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateDocumentNumber } from '../utils/documentNumber.js';
import { AuditService } from '../services/auditService.js';

const router = Router();

// GET /api/direct-purchases
router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.directPurchase.findMany({
      include: {
        purchaseRequest: { include: { requester: true, department: true } },
        items: { include: { item: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

const createDpSchema = z.object({
  prId: z.string().optional().nullable(),
  storeName: z.string().min(1),
  invoiceReceiptNumber: z.string().optional().nullable(),
  purchaserName: z.string().min(1),
  attachmentUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      quantity: z.number().min(0.01),
      unitId: z.string().min(1),
      unitPrice: z.number().min(0),
    })
  ).min(1),
});

// POST /api/direct-purchases
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createDpSchema.parse(req.body);
      const user = req.user!;

      const dpNumber = await generateDocumentNumber(prisma, 'DP');

      let total = 0;
      const preparedItems = data.items.map((i) => {
        const subtotal = i.quantity * i.unitPrice;
        total += subtotal;
        return {
          itemId: i.itemId,
          quantity: i.quantity,
          unitId: i.unitId,
          unitPrice: i.unitPrice,
          subtotal,
        };
      });

      const dp = await prisma.directPurchase.create({
        data: {
          dpNumber,
          prId: data.prId,
          storeName: data.storeName,
          invoiceReceiptNumber: data.invoiceReceiptNumber,
          purchaserName: data.purchaserName,
          totalAmount: total,
          attachmentUrl: data.attachmentUrl,
          notes: data.notes,
          status: 'COMPLETED',
          items: {
            create: preparedItems,
          },
        },
        include: { items: true },
      });

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'CREATE_DIRECT_PURCHASE',
        module: 'PURCHASING',
        documentNumber: dp.dpNumber,
        newValue: { totalAmount: total, store: data.storeName },
        ipAddress: req.ip,
      });

      return res.status(201).json({ success: true, data: dp });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateDocumentNumber } from '../utils/documentNumber.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/handovers
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const where: any = {};

    if (user.roleName === 'REQUESTER') {
      where.requesterId = user.id;
    }

    const hos = await prisma.handoverDocument.findMany({
      where,
      include: {
        requester: true,
        department: true,
        purchaseRequest: true,
        goodsReceipt: true,
        goodsIssue: true,
        items: {
          include: {
            item: { include: { unit: true } },
            unit: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: hos });
  } catch (error) {
    next(error);
  }
});

// GET /api/handovers/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ho = await prisma.handoverDocument.findUnique({
      where: { id: req.params.id as string },
      include: {
        requester: true,
        department: true,
        purchaseRequest: true,
        goodsReceipt: true,
        goodsIssue: true,
        items: {
          include: {
            item: { include: { unit: true } },
            unit: true,
          },
        },
      },
    });

    if (!ho) return res.status(404).json({ success: false, message: 'Dokumen serah terima tidak ditemukan' });
    return res.json({ success: true, data: ho });
  } catch (error) {
    next(error);
  }
});

const createHoSchema = z.object({
  prId: z.string().optional().nullable(),
  grId: z.string().optional().nullable(),
  giId: z.string().optional().nullable(),
  requesterId: z.string().min(1),
  departmentId: z.string().min(1),
  receiverName: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      quantity: z.number().min(0.01),
      unitId: z.string().min(1),
      notes: z.string().optional().nullable(),
    })
  ).min(1),
});

// POST /api/handovers - Create Handover
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createHoSchema.parse(req.body);
      const hoNumber = await generateDocumentNumber(prisma, 'HO');

      const ho = await prisma.handoverDocument.create({
        data: {
          hoNumber,
          prId: data.prId,
          grId: data.grId,
          giId: data.giId,
          requesterId: data.requesterId,
          departmentId: data.departmentId,
          receiverName: data.receiverName,
          status: 'WAITING_HANDOVER',
          notes: data.notes,
          items: {
            create: data.items.map((it) => ({
              itemId: it.itemId,
              quantity: it.quantity,
              unitId: it.unitId,
              notes: it.notes,
            })),
          },
        },
        include: { items: true },
      });

      await NotificationService.notify(prisma, {
        userId: data.requesterId,
        title: 'Konfirmasi Serah Terima Barang',
        message: `${ho.hoNumber} siap diserahterimakan. Mohon konfirmasi penerimaan fisik barang.`,
        link: `/handovers/${ho.id}`,
      });

      return res.status(201).json({ success: true, data: ho });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/handovers/:id/confirm - User confirmation & completion
router.post(
  '/:id/confirm',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { receiverSignatureNote } = req.body;
      const user = req.user!;

      const ho = await prisma.handoverDocument.findUnique({
        where: { id: req.params.id as string },
      });

      if (!ho) return res.status(404).json({ success: false, message: 'Dokumen serah terima tidak ditemukan' });

      const updated = await prisma.handoverDocument.update({
        where: { id: ho.id },
        data: {
          status: 'COMPLETED',
          receiverName: user.name,
          receiverSignatureNote: receiverSignatureNote || `Dikonfirmasi oleh ${user.name} pada ${new Date().toLocaleString('id-ID')}`,
        },
      });

      // Update PR status to COMPLETED
      if (ho.prId) {
        await prisma.purchaseRequest.update({
          where: { id: ho.prId },
          data: { status: 'COMPLETED' },
        });
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'CONFIRM_HANDOVER',
        module: 'HANDOVER',
        documentNumber: ho.hoNumber,
        newValue: { status: 'COMPLETED', signature: receiverSignatureNote },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: 'Konfirmasi serah terima selesai. Alur pengadaan barang tuntas (COMPLETED).',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

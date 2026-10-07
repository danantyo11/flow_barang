import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateDocumentNumber } from '../utils/documentNumber.js';
import { StockEngine } from '../services/stockEngine.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/goods-receipts
router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const grs = await prisma.goodsReceipt.findMany({
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            purchaseRequest: { include: { requester: true, department: true } },
          },
        },
        supplier: true,
        items: {
          include: {
            item: { include: { unit: true } },
            warehouse: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: grs });
  } catch (error) {
    next(error);
  }
});

// GET /api/goods-receipts/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gr = await prisma.goodsReceipt.findUnique({
      where: { id: req.params.id as string },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            purchaseRequest: { include: { requester: true, department: true } },
          },
        },
        supplier: true,
        items: {
          include: {
            item: { include: { unit: true } },
            warehouse: true,
            location: true,
          },
        },
      },
    });

    if (!gr) {
      return res.status(404).json({ success: false, message: 'Goods receipt tidak ditemukan' });
    }

    return res.json({ success: true, data: gr });
  } catch (error) {
    next(error);
  }
});

const createGrSchema = z.object({
  poId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  deliveryNoteNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  destination: z.enum(['STOCK', 'USER_REQUEST']).default('STOCK'),
  qcStatus: z.enum(['PASSED', 'PARTIAL', 'REJECTED']).default('PASSED'),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      poItemId: z.string().optional().nullable(),
      itemId: z.string().min(1),
      warehouseId: z.string().optional().nullable(),
      locationId: z.string().optional().nullable(),
      orderQty: z.number().min(0),
      receivedQty: z.number().min(0.01),
      goodQty: z.number().min(0),
      damagedQty: z.number().min(0).default(0),
      rejectedQty: z.number().min(0).default(0),
      notes: z.string().optional().nullable(),
    })
  ).min(1, 'Penerimaan harus memiliki minimal 1 item'),
});

// POST /api/goods-receipts - Process Receiving and QC
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createGrSchema.parse(req.body);
      const user = req.user!;

      // Validate quantities consistency: goodQty + damagedQty + rejectedQty <= receivedQty
      for (const item of data.items) {
        const sum = item.goodQty + item.damagedQty + item.rejectedQty;
        if (sum > item.receivedQty) {
          return res.status(400).json({
            success: false,
            message: `Jumlah QC (Baik: ${item.goodQty}, Rusak: ${item.damagedQty}, Tolak: ${item.rejectedQty}) melebihi Qty Diterima (${item.receivedQty}).`,
          });
        }
      }

      // Generate GR number
      const grNumber = await generateDocumentNumber(prisma, 'GR');

      let poRecord: any = null;
      if (data.poId) {
        poRecord = await prisma.purchaseOrder.findUnique({
          where: { id: data.poId },
          include: { items: true, purchaseRequest: true },
        });
      }

      const supplierId = data.supplierId || poRecord?.supplierId || null;

      // Create Goods Receipt document
      const gr = await prisma.goodsReceipt.create({
        data: {
          grNumber,
          poId: data.poId,
          supplierId,
          receivedBy: user.name,
          deliveryNoteNumber: data.deliveryNoteNumber,
          invoiceNumber: data.invoiceNumber,
          destination: data.destination,
          qcStatus: data.qcStatus,
          status: 'POSTED',
          notes: data.notes,
          items: {
            create: data.items.map((it) => ({
              poItemId: it.poItemId,
              itemId: it.itemId,
              warehouseId: it.warehouseId,
              locationId: it.locationId,
              orderQty: it.orderQty,
              receivedQty: it.receivedQty,
              goodQty: it.goodQty,
              damagedQty: it.damagedQty,
              rejectedQty: it.rejectedQty,
              remainingQty: Math.max(0, it.orderQty - it.goodQty),
              notes: it.notes,
            })),
          },
        },
        include: { items: true },
      });

      // Stock posting logic:
      // If destination === 'STOCK':
      // ONLY goodQty is added to available stock. Damaged & rejected are logged but NOT added to stock!
      if (data.destination === 'STOCK') {
        for (const grItem of data.items) {
          if (grItem.goodQty > 0 && grItem.warehouseId) {
            await StockEngine.recordMovement(prisma, {
              transactionType: 'RECEIVING',
              itemId: grItem.itemId,
              warehouseId: grItem.warehouseId,
              locationId: grItem.locationId,
              referenceType: 'GR',
              referenceId: gr.grNumber,
              quantity: grItem.goodQty,
              notes: `Penerimaan barang dari PO (${gr.grNumber}). QC: ${data.qcStatus}`,
              userId: user.id,
            });
          }
        }
      }

      // Update PO items received quantities and PO status (Partial vs Full)
      if (poRecord) {
        let isFullyReceived = true;

        for (const poItem of poRecord.items) {
          const matchedGrItem = data.items.find((i) => i.poItemId === poItem.id || i.itemId === poItem.itemId);
          const newlyReceived = matchedGrItem ? matchedGrItem.goodQty : 0;
          const totalReceivedSoFar = poItem.receivedQty + newlyReceived;
          const remaining = Math.max(0, poItem.quantity - totalReceivedSoFar);

          if (remaining > 0) {
            isFullyReceived = false;
          }

          await prisma.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQty: totalReceivedSoFar,
              remainingQty: remaining,
            },
          });
        }

        const newPoStatus = isFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';
        await prisma.purchaseOrder.update({
          where: { id: poRecord.id },
          data: { status: newPoStatus },
        });

        if (poRecord.prId) {
          const newPrStatus = data.destination === 'USER_REQUEST'
            ? 'WAITING_HANDOVER'
            : (isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED');

          await prisma.purchaseRequest.update({
            where: { id: poRecord.prId },
            data: { status: newPrStatus },
          });

          // If destination is USER_REQUEST, notify requester that items are ready for pickup/handover
          if (data.destination === 'USER_REQUEST' && poRecord.purchaseRequest) {
            await NotificationService.notify(prisma, {
              userId: poRecord.purchaseRequest.requesterId,
              title: 'Barang Siap Diambil / Handover',
              message: `Barang dari ${poRecord.poNumber} telah diterima gudang dan siap diserahterimakan.`,
              link: `/handovers`,
            });
          }
        }
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'RECEIVE_GOODS',
        module: 'RECEIVING',
        documentNumber: gr.grNumber,
        newValue: { destination: data.destination, qcStatus: data.qcStatus, itemsCount: data.items.length },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        success: true,
        message: 'Penerimaan barang dan QC berhasil diproses',
        data: gr,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

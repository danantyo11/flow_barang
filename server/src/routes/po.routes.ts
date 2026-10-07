import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateDocumentNumber } from '../utils/documentNumber.js';
import { ApprovalEngine } from '../services/approvalEngine.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/purchase-orders
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, supplierId } = req.query;

    const where: any = {};
    if (status) where.status = String(status);
    if (supplierId) where.supplierId = String(supplierId);

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        purchaseRequest: {
          include: {
            requester: true,
            department: true,
          },
        },
        items: {
          include: {
            item: { include: { unit: true, category: true } },
            unit: true,
          },
        },
        goodsReceipts: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: pos });
  } catch (error) {
    next(error);
  }
});

// GET /api/purchase-orders/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      include: {
        supplier: true,
        purchaseRequest: {
          include: {
            requester: true,
            department: true,
          },
        },
        items: {
          include: {
            item: {
              include: {
                unit: true,
                category: true,
                stockBalances: { include: { warehouse: true, location: true } },
              },
            },
            unit: true,
          },
        },
        goodsReceipts: {
          include: { items: true },
        },
      },
    });

    if (!po) {
      return res.status(404).json({ success: false, message: 'PO tidak ditemukan' });
    }

    // Also fetch approval logs if any
    const approvalInstance = await prisma.approvalInstance.findFirst({
      where: { documentType: 'PO', documentId: po.id },
      include: {
        logs: {
          include: { approver: true },
          orderBy: { actedAt: 'asc' },
        },
      },
    });

    return res.json({
      success: true,
      data: {
        ...po,
        approvalInstance,
      },
    });
  } catch (error) {
    next(error);
  }
});

const poItemSchema = z.object({
  prItemId: z.string().optional().nullable(),
  itemId: z.string().min(1),
  specification: z.string().optional().nullable(),
  quantity: z.number().min(0.01),
  unitId: z.string().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  taxPercent: z.number().min(0).default(0),
});

const createPoSchema = z.object({
  prId: z.string().optional().nullable(),
  supplierId: z.string().min(1),
  deliveryDate: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  shippingTerms: z.string().optional().nullable(),
  currency: z.string().default('IDR'),
  notes: z.string().optional().nullable(),
  purchaseType: z.enum(['VENDOR', 'DIRECT']).default('VENDOR'),
  items: z.array(poItemSchema).min(1, 'PO harus memiliki minimal 1 item'),
});

// POST /api/purchase-orders - Create PO (Draft)
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createPoSchema.parse(req.body);
      const user = req.user!;

      // Backend recalculates subtotal, discount, tax, total automatically!
      let calculatedSubtotal = 0;
      let calculatedDiscountTotal = 0;
      let calculatedTaxTotal = 0;

      const preparedItems = data.items.map((item) => {
        const lineGross = item.quantity * item.unitPrice;
        const lineDiscount = lineGross * ((item.discount || 0) / 100);
        const lineNet = lineGross - lineDiscount;
        const lineTax = lineNet * ((item.taxPercent || 0) / 100);
        const lineSubtotal = lineNet + lineTax;

        calculatedSubtotal += lineGross;
        calculatedDiscountTotal += lineDiscount;
        calculatedTaxTotal += lineTax;

        return {
          prItemId: item.prItemId,
          itemId: item.itemId,
          specification: item.specification,
          quantity: item.quantity,
          unitId: item.unitId,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxPercent: item.taxPercent,
          subtotal: lineSubtotal,
          receivedQty: 0,
          remainingQty: item.quantity,
        };
      });

      const totalAmount = calculatedSubtotal - calculatedDiscountTotal + calculatedTaxTotal;

      if (totalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Total nilai PO harus lebih besar dari 0.',
        });
      }

      const poNumber = await generateDocumentNumber(prisma, 'PO');

      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          prId: data.prId,
          supplierId: data.supplierId,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          paymentTerms: data.paymentTerms,
          shippingTerms: data.shippingTerms,
          currency: data.currency,
          subtotal: calculatedSubtotal,
          discount: calculatedDiscountTotal,
          taxAmount: calculatedTaxTotal,
          totalAmount,
          notes: data.notes,
          status: 'DRAFT',
          purchaseType: data.purchaseType,
          createdBy: user.name,
          items: {
            create: preparedItems,
          },
        },
        include: { items: true, supplier: true },
      });

      if (data.prId) {
        await prisma.purchaseRequest.update({
          where: { id: data.prId },
          data: { status: 'WAITING_PO' },
        });
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'CREATE_PO',
        module: 'PO',
        documentNumber: po.poNumber,
        newValue: { totalAmount, poNumber: po.poNumber },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        success: true,
        message: 'Draft PO berhasil dibuat',
        data: po,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/purchase-orders/:id/submit-approval - Submit PO for approval
router.post(
  '/:id/submit-approval',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: req.params.id as string },
        include: { items: true },
      });

      if (!po) return res.status(404).json({ success: false, message: 'PO tidak ditemukan' });
      if (po.status !== 'DRAFT' && po.status !== 'REVISION_REQUIRED') {
        return res.status(400).json({
          success: false,
          message: `PO dalam status "${po.status}" tidak dapat diajukan untuk approval.`,
        });
      }

      if (po.totalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'PO tidak dapat diajukan approval jika total nilai <= 0.',
        });
      }

      // Initialize approval workflow via engine
      const { instance, flow } = await ApprovalEngine.initializeApproval(
        prisma,
        'PO',
        po.id,
        po.poNumber,
        po.totalAmount
      );

      const updatedPo = await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'WAITING_APPROVAL' },
      });

      if (po.prId) {
        await prisma.purchaseRequest.update({
          where: { id: po.prId },
          data: { status: 'WAITING_APPROVAL' },
        });
      }

      await NotificationService.notify(prisma, {
        roleName: 'APPROVER',
        title: 'PO Menunggu Persetujuan',
        message: `${po.poNumber} senilai ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(po.totalAmount)} membutuhkan persetujuan.`,
        link: `/approvals?id=${instance.id}`,
      });

      return res.json({
        success: true,
        message: 'PO berhasil diajukan untuk persetujuan pimpinan',
        data: { po: updatedPo, approvalInstance: instance },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/purchase-orders/:id/send - Mark PO sent to supplier
router.post(
  '/:id/send',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id as string } });
      if (!po) return res.status(404).json({ success: false, message: 'PO tidak ditemukan' });

      if (po.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Hanya PO yang telah disetujui (APPROVED) yang dapat dikirim ke vendor.',
        });
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'SENT' },
      });

      if (po.prId) {
        await prisma.purchaseRequest.update({
          where: { id: po.prId },
          data: { status: 'ORDERED' },
        });
      }

      await NotificationService.notify(prisma, {
        roleName: 'WAREHOUSE',
        title: 'PO Telah Diterbitkan ke Vendor',
        message: `${po.poNumber} telah dikirim ke vendor, bersiap untuk penerimaan barang.`,
        link: `/goods-receipts/new?poId=${po.id}`,
      });

      return res.json({ success: true, message: 'PO berhasil ditandai telah dikirim ke supplier', data: updated });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

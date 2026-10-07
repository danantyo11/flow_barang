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

// GET /api/purchase-orders/pending-items - Get all candidate PR items waiting to be ordered in a PO
router.get('/pending-items', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Fetch all PR items that need purchasing and are not already completed or cancelled
    const prItems = await prisma.purchaseRequestItem.findMany({
      where: {
        purchaseQty: { gt: 0 },
        purchaseRequest: {
          status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] },
        },
        // We only want items that haven't been fully included in an active (non-cancelled) PO
        poItems: {
          none: {
            purchaseOrder: {
              status: { notIn: ['CANCELLED', 'REJECTED'] },
            },
          },
        },
      },
      include: {
        item: {
          include: {
            unit: true,
            category: true,
          },
        },
        unit: true,
        purchaseRequest: {
          include: {
            requester: { select: { id: true, name: true, employeeNumber: true } },
            department: true,
            quotations: {
              include: {
                supplier: true,
                items: true,
              },
            },
          },
        },
      },
      orderBy: [
        { purchaseRequest: { priority: 'asc' } },
        { purchaseRequest: { createdAt: 'desc' } },
      ],
    });

    // 2. Format items with recommended vendor / quotation price if available
    const formatted = prItems.map((pi) => {
      const pr = pi.purchaseRequest;
      // Check if there is an approved or selected quotation for this PR & item
      const winningQuot = pr.quotations.find((q) => q.isSelected);
      const quotItem = (winningQuot || pr.quotations[0])?.items?.find(
        (qi) => qi.prItemId === pi.id || qi.itemId === pi.itemId
      );

      return {
        id: pi.id,
        prId: pr.id,
        prNumber: pr.prNumber,
        requestDate: pr.requestDate,
        requiredDate: pr.requiredDate,
        priority: pr.priority,
        purpose: pr.purpose,
        requesterName: pr.requester?.name,
        departmentName: pr.department?.departmentName,
        itemId: pi.itemId,
        itemCode: pi.item?.itemCode,
        itemName: pi.item?.itemName,
        specification: pi.specification || pi.item?.specification || '',
        categoryName: pi.item?.category?.name,
        requestedQty: pi.requestedQty,
        availableStock: pi.availableStock,
        allocatedQty: pi.allocatedQty,
        purchaseQty: pi.purchaseQty,
        unitId: pi.unitId,
        unitCode: pi.unit?.code || pi.unit?.name,
        estimatedPrice: pi.estimatedPrice || 0,
        suggestedSupplierId: winningQuot?.supplierId || (pr.quotations[0]?.supplierId ?? null),
        suggestedSupplierName: winningQuot?.supplier?.supplierName || (pr.quotations[0]?.supplier?.supplierName ?? null),
        suggestedPrice: quotItem ? quotItem.unitPrice : pi.estimatedPrice || 0,
      };
    });

    return res.json({ success: true, count: formatted.length, data: formatted });
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
  prItemIds: z.array(z.string()).optional(),
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

      const preparedItems = data.items.flatMap((item) => {
        // If this item was consolidated from multiple PR items
        if (item.prItemIds && item.prItemIds.length > 1) {
          // Create records or assign first prItemId to main record
          const lineGross = item.quantity * item.unitPrice;
          const lineDiscount = lineGross * ((item.discount || 0) / 100);
          const lineNet = lineGross - lineDiscount;
          const lineTax = lineNet * ((item.taxPercent || 0) / 100);
          const lineSubtotal = lineNet + lineTax;

          calculatedSubtotal += lineGross;
          calculatedDiscountTotal += lineDiscount;
          calculatedTaxTotal += lineTax;

          // Create primary PO item with primary prItemId
          const primary = {
            prItemId: item.prItemIds[0],
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

          // Also create tracking links for the other consolidated prItemIds with 0 qty/subtotal so Prisma relations bind them
          const secondaries = item.prItemIds.slice(1).map((secId: string) => ({
            prItemId: secId,
            itemId: item.itemId,
            specification: item.specification ? `${item.specification} (Konsolidasi item PR)` : '(Konsolidasi item PR)',
            quantity: 0,
            unitId: item.unitId,
            unitPrice: 0,
            discount: 0,
            taxPercent: 0,
            subtotal: 0,
            receivedQty: 0,
            remainingQty: 0,
          }));

          return [primary, ...secondaries];
        }

        const lineGross = item.quantity * item.unitPrice;
        const lineDiscount = lineGross * ((item.discount || 0) / 100);
        const lineNet = lineGross - lineDiscount;
        const lineTax = lineNet * ((item.taxPercent || 0) / 100);
        const lineSubtotal = lineNet + lineTax;

        calculatedSubtotal += lineGross;
        calculatedDiscountTotal += lineDiscount;
        calculatedTaxTotal += lineTax;

        return [{
          prItemId: (item.prItemIds && item.prItemIds[0]) || item.prItemId || null,
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
        }];
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

      // Update PR items status and parent PR status
      const linkedPrItemIds = data.items
        .flatMap((it) => (it.prItemIds && it.prItemIds.length > 0 ? it.prItemIds : [it.prItemId]))
        .filter(Boolean) as string[];

      if (linkedPrItemIds.length > 0) {
        await prisma.purchaseRequestItem.updateMany({
          where: { id: { in: linkedPrItemIds } },
          data: { status: 'ORDERED' },
        });

        // Determine all affected PRs
        const affectedPrIds = new Set<string>();
        if (data.prId) affectedPrIds.add(data.prId);

        const itemsWithPr = await prisma.purchaseRequestItem.findMany({
          where: { id: { in: linkedPrItemIds } },
          select: { prId: true },
        });
        itemsWithPr.forEach((i) => affectedPrIds.add(i.prId));

        for (const prIdToUpdate of affectedPrIds) {
          // Check if all purchase items in this PR now have active POs
          const remainingUnordered = await prisma.purchaseRequestItem.count({
            where: {
              prId: prIdToUpdate,
              purchaseQty: { gt: 0 },
              status: { notIn: ['ORDERED', 'COMPLETED'] },
            },
          });

          await prisma.purchaseRequest.update({
            where: { id: prIdToUpdate },
            data: { status: remainingUnordered === 0 ? 'WAITING_APPROVAL' : 'WAITING_PO' },
          });
        }
      } else if (data.prId) {
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

// DELETE /api/purchase-orders/:id - Cancel/Delete PO and release items back to candidate pool
router.delete(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: req.params.id as string },
        include: { items: true, goodsReceipts: true },
      });

      if (!po) return res.status(404).json({ success: false, message: 'PO tidak ditemukan' });

      // If PO already has goods receipts, it cannot be deleted
      if (po.goodsReceipts.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'PO tidak dapat dihapus karena sudah memiliki penerimaan barang (Goods Receipt).',
        });
      }

      // Collect linked PR item IDs
      const prItemIds = po.items.map((it) => it.prItemId).filter(Boolean) as string[];

      // Delete PO (cascades to PO items)
      await prisma.purchaseOrder.delete({
        where: { id: po.id },
      });

      // Restore PR items status back to PURCHASING so they reappear in the PO creation candidate list
      if (prItemIds.length > 0) {
        await prisma.purchaseRequestItem.updateMany({
          where: { id: { in: prItemIds } },
          data: { status: 'PURCHASING' },
        });

        // Update affected PRs status back to WAITING_PRICE / PROCUREMENT if needed
        const itemsWithPr = await prisma.purchaseRequestItem.findMany({
          where: { id: { in: prItemIds } },
          select: { prId: true },
        });
        const prIds = Array.from(new Set(itemsWithPr.map((i) => i.prId)));

        for (const prId of prIds) {
          await prisma.purchaseRequest.update({
            where: { id: prId },
            data: { status: 'WAITING_PRICE' },
          });
        }
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'DELETE_PO',
        module: 'PO',
        documentNumber: po.poNumber,
        oldValue: { poNumber: po.poNumber, totalAmount: po.totalAmount },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `PO ${po.poNumber} berhasil dihapus. Item barang telah dikembalikan ke daftar siap PO.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

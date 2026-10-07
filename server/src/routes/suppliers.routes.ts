import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuditService } from '../services/auditService.js';

const router = Router();

// GET /api/suppliers
router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { supplierName: 'asc' },
    });
    return res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
});

// POST /api/suppliers
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        supplierCode: z.string().min(1),
        supplierName: z.string().min(1),
        address: z.string().optional().nullable(),
        contactPerson: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        taxNumber: z.string().optional().nullable(),
        paymentTerms: z.string().optional().nullable(),
        leadTimeDays: z.number().default(0),
      });

      const data = schema.parse(req.body);
      const supplier = await prisma.supplier.create({ data });
      return res.status(201).json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/suppliers/quotations/:prId - Compare quotations for a given PR
router.get(
  '/quotations/:prId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prId = req.params.prId as string;
      const quotations = await prisma.supplierQuotation.findMany({
        where: { prId },
        include: {
          supplier: true,
          items: {
            include: {
              item: { include: { unit: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({ success: true, data: quotations });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/suppliers/quotations - Record supplier quotation
const quotationSchema = z.object({
  prId: z.string().min(1),
  supplierId: z.string().min(1),
  quotationNumber: z.string().min(1),
  leadTimeDays: z.number().default(0),
  paymentTerms: z.string().optional().nullable(),
  shippingCost: z.number().default(0),
  taxPercent: z.number().default(0),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      prItemId: z.string().optional().nullable(),
      itemId: z.string().min(1),
      unitPrice: z.number().min(0),
      discount: z.number().default(0),
      taxPercent: z.number().default(0),
      leadTimeDays: z.number().default(0),
      notes: z.string().optional().nullable(),
    })
  ).min(1),
});

router.post(
  '/quotations',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = quotationSchema.parse(req.body);

      // Recalculate total accurately on backend
      let itemsTotal = 0;
      const preparedItems = data.items.map((item) => {
        const lineNet = item.unitPrice * (1 - (item.discount || 0) / 100);
        const lineTax = lineNet * ((item.taxPercent || 0) / 100);
        const subtotal = lineNet + lineTax;
        itemsTotal += subtotal;
        return {
          prItemId: item.prItemId,
          itemId: item.itemId,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxPercent: item.taxPercent,
          subtotal,
          leadTimeDays: item.leadTimeDays,
          notes: item.notes,
        };
      });

      const totalAmount = itemsTotal + (data.shippingCost || 0);

      const quotation = await prisma.supplierQuotation.create({
        data: {
          quotationNumber: data.quotationNumber,
          prId: data.prId,
          supplierId: data.supplierId,
          leadTimeDays: data.leadTimeDays,
          paymentTerms: data.paymentTerms,
          shippingCost: data.shippingCost,
          taxPercent: data.taxPercent,
          totalAmount,
          notes: data.notes,
          items: {
            create: preparedItems,
          },
        },
        include: { items: true, supplier: true },
      });

      await AuditService.log(prisma, {
        userId: req.user?.id,
        userName: req.user?.name || 'User',
        action: 'CREATE_QUOTATION',
        module: 'PURCHASING',
        documentNumber: quotation.quotationNumber,
        newValue: quotation,
        ipAddress: req.ip,
      });

      return res.status(201).json({ success: true, data: quotation });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/suppliers/quotations/:id/select - Select winning quotation with reason
router.post(
  '/quotations/:id/select',
  authenticate,
  requireRole(['ADMIN', 'PURCHASING']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { selectionReason } = req.body;
      const quotationId = req.params.id as string;

      const quotation = await prisma.supplierQuotation.findUnique({
        where: { id: quotationId },
      });

      if (!quotation || !quotation.prId) {
        return res.status(404).json({ success: false, message: 'Penawaran tidak ditemukan' });
      }

      // Unselect all other quotations for this PR and select this one
      await prisma.$transaction([
        prisma.supplierQuotation.updateMany({
          where: { prId: quotation.prId },
          data: { isSelected: false, selectionReason: null },
        }),
        prisma.supplierQuotation.update({
          where: { id: quotationId },
          data: { isSelected: true, selectionReason: selectionReason || 'Harga dan terms terbaik' },
        }),
      ]);

      return res.json({ success: true, message: 'Vendor terpilih berhasil disimpan' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

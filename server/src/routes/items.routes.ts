import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuditService } from '../services/auditService.js';

const router = Router();

// GET /api/items
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, isCritical, status } = req.query;

    const where: any = {};
    if (categoryId) where.categoryId = String(categoryId);
    if (isCritical === 'true') where.isCritical = true;
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'INACTIVE') where.isActive = false;

    const items = await prisma.item.findMany({
      where,
      include: {
        category: true,
        subcategory: true,
        unit: true,
        defaultWarehouse: true,
        stockBalances: {
          include: {
            warehouse: true,
            location: true,
          },
        },
      },
      orderBy: { itemCode: 'asc' },
    });

    // Compute stock status per business rule (Section 37)
    const formatted = items.map((item) => {
      const totalStock = item.stockBalances.reduce((sum, b) => sum + b.quantity, 0);

      let stockStatus = 'NORMAL';
      if (totalStock <= item.criticalStock) {
        stockStatus = 'CRITICAL';
      } else if (totalStock <= item.minimumStock) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        id: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category.name,
        categoryId: item.categoryId,
        subcategory: item.subcategory?.name || null,
        subcategoryId: item.subcategoryId,
        unit: item.unit.name,
        unitCode: item.unit.code,
        unitId: item.unitId,
        specification: item.specification,
        brand: item.brand,
        minimumStock: item.minimumStock,
        maximumStock: item.maximumStock,
        reorderPoint: item.reorderPoint,
        criticalStock: item.criticalStock,
        isCritical: item.isCritical,
        defaultWarehouse: item.defaultWarehouse?.warehouseName || null,
        defaultWarehouseId: item.defaultWarehouseId,
        isActive: item.isActive,
        totalStock,
        stockStatus,
        stockBalances: item.stockBalances,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

// GET /api/items/categories
router.get('/categories', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.itemCategory.findMany({
      include: { subcategories: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// GET /api/items/units
router.get('/units', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const units = await prisma.unit.findMany({ orderBy: { code: 'asc' } });
    return res.json({ success: true, data: units });
  } catch (error) {
    next(error);
  }
});

// GET /api/items/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id as string },
      include: {
        category: true,
        subcategory: true,
        unit: true,
        defaultWarehouse: true,
        stockBalances: {
          include: {
            warehouse: true,
            location: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    const totalStock = item.stockBalances.reduce((sum, b) => sum + b.quantity, 0);
    let stockStatus = 'NORMAL';
    if (totalStock <= item.criticalStock) {
      stockStatus = 'CRITICAL';
    } else if (totalStock <= item.minimumStock) {
      stockStatus = 'LOW_STOCK';
    }

    return res.json({
      success: true,
      data: { ...item, totalStock, stockStatus },
    });
  } catch (error) {
    next(error);
  }
});

const itemSchema = z.object({
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  categoryId: z.string().min(1),
  subcategoryId: z.string().optional().nullable(),
  unitId: z.string().min(1),
  specification: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  minimumStock: z.number().min(0).default(0),
  maximumStock: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(0),
  criticalStock: z.number().min(0).default(0),
  isCritical: z.boolean().default(false),
  defaultWarehouseId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// POST /api/items
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = itemSchema.parse(req.body);

      const existing = await prisma.item.findUnique({
        where: { itemCode: data.itemCode },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Kode barang "${data.itemCode}" sudah digunakan.`,
        });
      }

      const item = await prisma.item.create({ data });

      await AuditService.log(prisma, {
        userId: req.user?.id,
        userName: req.user?.name || 'User',
        action: 'CREATE_ITEM',
        module: 'MASTER_DATA',
        documentNumber: item.itemCode,
        newValue: item,
        ipAddress: req.ip,
      });

      return res.status(201).json({
        success: true,
        message: 'Barang berhasil ditambahkan',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/items/:id
router.put(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = itemSchema.parse(req.body);
      const itemId = req.params.id as string;
      const existing = await prisma.item.findUnique({ where: { id: itemId } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
      }

      const updated = await prisma.item.update({
        where: { id: itemId },
        data,
      });

      await AuditService.log(prisma, {
        userId: req.user?.id,
        userName: req.user?.name || 'User',
        action: 'UPDATE_ITEM',
        module: 'MASTER_DATA',
        documentNumber: updated.itemCode,
        oldValue: existing,
        newValue: updated,
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: 'Data barang berhasil diperbarui',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

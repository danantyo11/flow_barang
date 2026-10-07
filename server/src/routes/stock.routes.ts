import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { StockEngine } from '../services/stockEngine.js';
import { AuditService } from '../services/auditService.js';

const router = Router();

// GET /api/stock/balances
router.get('/balances', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId, status } = req.query;

    const items = await prisma.item.findMany({
      include: {
        category: true,
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

    const result = items.map((it) => {
      let filteredBalances = it.stockBalances;
      if (warehouseId) {
        filteredBalances = filteredBalances.filter((b) => b.warehouseId === String(warehouseId));
      }

      const totalQty = filteredBalances.reduce((sum, b) => sum + b.quantity, 0);

      let stockStatus = 'NORMAL';
      if (totalQty <= it.criticalStock) {
        stockStatus = 'CRITICAL';
      } else if (totalQty <= it.minimumStock) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        item: {
          id: it.id,
          itemCode: it.itemCode,
          itemName: it.itemName,
          category: it.category.name,
          unit: it.unit.name,
          minimumStock: it.minimumStock,
          maximumStock: it.maximumStock,
          reorderPoint: it.reorderPoint,
          criticalStock: it.criticalStock,
          isCritical: it.isCritical,
        },
        totalQuantity: totalQty,
        stockStatus,
        balances: filteredBalances,
      };
    });

    let filtered = result;
    if (status) {
      filtered = filtered.filter((r) => r.stockStatus === String(status));
    }

    return res.json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/card/:itemId - Chronological Stock Card
router.get('/card/:itemId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId } = req.query;
    const itemId = req.params.itemId as string;

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { unit: true, category: true },
    });

    if (!item) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });

    const where: any = { itemId };
    if (warehouseId) where.warehouseId = String(warehouseId);

    const transactions = await prisma.stockTransaction.findMany({
      where,
      include: {
        warehouse: true,
        location: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Format stock card entries
    const ledger = transactions.map((t) => {
      const isPositive = t.quantity > 0;
      return {
        id: t.id,
        date: t.createdAt,
        transactionNumber: t.transactionNumber,
        type: t.transactionType,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        warehouse: t.warehouse.warehouseName,
        location: t.location?.locationName || '-',
        qtyIn: isPositive ? t.quantity : 0,
        qtyOut: !isPositive ? Math.abs(t.quantity) : 0,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        unitCost: t.unitCost,
        notes: t.notes,
      };
    });

    return res.json({
      success: true,
      data: {
        item,
        currentStock: ledger.length > 0 ? ledger[ledger.length - 1].balanceAfter : 0,
        ledger,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stock/adjust - Stock Adjustment
const adjustSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().min(0.01),
  notes: z.string().min(1, 'Alasan penyesuaian wajib diisi'),
});

router.post(
  '/adjust',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = adjustSchema.parse(req.body);
      const user = req.user!;

      const result = await StockEngine.recordMovement(prisma, {
        transactionType: data.type,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: `ADJ-${Date.now()}`,
        quantity: data.quantity,
        notes: data.notes,
        userId: user.id,
      });

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'STOCK_ADJUSTMENT',
        module: 'STOCK',
        documentNumber: result.transaction.transactionNumber,
        newValue: { type: data.type, qty: data.quantity, balanceAfter: result.balanceAfter },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: 'Penyesuaian stok berhasil dicatat',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

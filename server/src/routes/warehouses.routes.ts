import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/warehouses
router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        locations: true,
      },
      orderBy: { warehouseCode: 'asc' },
    });
    return res.json({ success: true, data: warehouses });
  } catch (error) {
    next(error);
  }
});

// POST /api/warehouses
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        warehouseCode: z.string().min(1),
        warehouseName: z.string().min(1),
        address: z.string().optional().nullable(),
      });

      const data = schema.parse(req.body);
      const wh = await prisma.warehouse.create({ data });
      return res.status(201).json({ success: true, data: wh });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/warehouses/:id/locations
router.post(
  '/:id/locations',
  authenticate,
  requireRole(['ADMIN', 'WAREHOUSE']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        locationName: z.string().min(1),
        rack: z.string().optional().nullable(),
        bin: z.string().optional().nullable(),
      });

      const data = schema.parse(req.body);
      const location = await prisma.warehouseLocation.create({
        data: {
          warehouseId: req.params.id as string,
          ...data,
        },
      });
      return res.status(201).json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/audit-logs
router.get(
  '/',
  authenticate,
  requireRole(['ADMIN', 'MANAGEMENT']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { module, action } = req.query;
      const where: any = {};
      if (module) where.module = String(module);
      if (action) where.action = String(action);

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

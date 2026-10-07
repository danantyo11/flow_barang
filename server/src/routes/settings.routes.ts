import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/settings
router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });
    return res.json({ success: true, data: map, list: settings });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/:key
router.put(
  '/:key',
  authenticate,
  requireRole(['ADMIN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { value, description } = req.body;
      const key = req.params.key as string;
      const updated = await prisma.systemSetting.upsert({
        where: { key },
        update: { value, description },
        create: { key, value, description },
      });
      return res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

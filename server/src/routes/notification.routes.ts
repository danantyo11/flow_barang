import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // Find role ID
    const role = await prisma.role.findUnique({
      where: { name: user.roleName },
    });

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: user.id },
          { roleId: role?.id || '' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.json({ success: true, unreadCount, data: notifications });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.notification.update({
      where: { id: req.params.id as string },
      data: { isRead: true },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const role = await prisma.role.findUnique({ where: { name: user.roleName } });

    await prisma.notification.updateMany({
      where: {
        OR: [
          { userId: user.id },
          { roleId: role?.id || '' },
        ],
      },
      data: { isRead: true },
    });

    return res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
  } catch (error) {
    next(error);
  }
});

export default router;

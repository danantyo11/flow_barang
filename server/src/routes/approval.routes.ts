import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ApprovalEngine } from '../services/approvalEngine.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/approvals/flows - List configured approval matrices
router.get('/flows', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const flows = await prisma.approvalFlow.findMany({
      include: {
        steps: {
          include: { role: true },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { minAmount: 'asc' },
    });
    return res.json({ success: true, data: flows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/approvals/flows/:id - Admin updates threshold configuration
router.put(
  '/flows/:id',
  authenticate,
  requireRole(['ADMIN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        minAmount: z.number().min(0),
        maxAmount: z.number().nullable().optional(),
        description: z.string().optional().nullable(),
      });

      const data = schema.parse(req.body);
      const updated = await prisma.approvalFlow.update({
        where: { id: req.params.id as string },
        data,
      });

      return res.json({ success: true, message: 'Approval flow berhasil diperbarui', data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/approvals/pending - Pending approval tasks
router.get('/pending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instances = await prisma.approvalInstance.findMany({
      where: { status: 'PENDING' },
      include: {
        logs: {
          include: { approver: true },
          orderBy: { actedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with document details
    const enriched = await Promise.all(
      instances.map(async (inst) => {
        let docDetails: any = null;
        if (inst.documentType === 'PO') {
          docDetails = await prisma.purchaseOrder.findUnique({
            where: { id: inst.documentId },
            include: {
              supplier: true,
              items: { include: { item: true, unit: true } },
              purchaseRequest: { include: { department: true } },
            },
          });
        }
        return {
          ...inst,
          document: docDetails,
        };
      })
    );

    return res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

const actionSchema = z.object({
  comments: z.string().optional().nullable(),
});

// POST /api/approvals/:id/approve
router.post(
  '/:id/approve',
  authenticate,
  requireRole(['ADMIN', 'APPROVER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comments } = actionSchema.parse(req.body);
      const user = req.user!;

      const updatedInstance = await ApprovalEngine.processAction(
        prisma,
        req.params.id as string,
        user.id,
        'APPROVE',
        comments || 'Approved'
      );

      // If fully approved, update document status
      if (updatedInstance.status === 'APPROVED') {
        if (updatedInstance.documentType === 'PO') {
          const po = await prisma.purchaseOrder.update({
            where: { id: updatedInstance.documentId },
            data: {
              status: 'APPROVED',
              approvedBy: user.name,
              approvedAt: new Date(),
            },
          });

          if (po.prId) {
            await prisma.purchaseRequest.update({
              where: { id: po.prId },
              data: { status: 'APPROVED' },
            });
          }

          await NotificationService.notify(prisma, {
            roleName: 'PURCHASING',
            title: 'PO Disetujui Pimpinan',
            message: `${updatedInstance.documentNumber} telah disetujui penuh. Siap dikirim ke vendor.`,
            link: `/purchase-orders/${po.id}`,
          });
        }
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'APPROVE_DOCUMENT',
        module: 'APPROVAL',
        documentNumber: updatedInstance.documentNumber,
        newValue: { step: updatedInstance.currentStep, status: updatedInstance.status, comments },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: updatedInstance.status === 'APPROVED' ? 'Dokumen disetujui secara final' : 'Tahap approval berhasil disetujui',
        data: updatedInstance,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/approvals/:id/reject
router.post(
  '/:id/reject',
  authenticate,
  requireRole(['ADMIN', 'APPROVER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comments } = actionSchema.parse(req.body);
      const user = req.user!;

      const updatedInstance = await ApprovalEngine.processAction(
        prisma,
        req.params.id as string,
        user.id,
        'REJECT',
        comments || 'Rejected'
      );

      if (updatedInstance.documentType === 'PO') {
        const po = await prisma.purchaseOrder.update({
          where: { id: updatedInstance.documentId },
          data: { status: 'REJECTED' },
        });

        if (po.prId) {
          await prisma.purchaseRequest.update({
            where: { id: po.prId },
            data: { status: 'REJECTED' },
          });
        }

        await NotificationService.notify(prisma, {
          roleName: 'PURCHASING',
          title: 'PO Ditolak',
          message: `${updatedInstance.documentNumber} ditolak oleh ${user.name}. Alasan: ${comments || '-'}`,
          link: `/purchase-orders/${po.id}`,
        });
      }

      await AuditService.log(prisma, {
        userId: user.id,
        userName: user.name,
        action: 'REJECT_DOCUMENT',
        module: 'APPROVAL',
        documentNumber: updatedInstance.documentNumber,
        newValue: { comments },
        ipAddress: req.ip,
      });

      return res.json({ success: true, message: 'Dokumen ditolak', data: updatedInstance });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/approvals/:id/revision
router.post(
  '/:id/revision',
  authenticate,
  requireRole(['ADMIN', 'APPROVER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comments } = actionSchema.parse(req.body);
      const user = req.user!;

      const updatedInstance = await ApprovalEngine.processAction(
        prisma,
        req.params.id as string,
        user.id,
        'REVISION_REQUIRED',
        comments || 'Mohon revisi'
      );

      if (updatedInstance.documentType === 'PO') {
        await prisma.purchaseOrder.update({
          where: { id: updatedInstance.documentId },
          data: { status: 'DRAFT' }, // Back to draft for revision
        });
      }

      return res.json({ success: true, message: 'Permintaan revisi dikirim', data: updatedInstance });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

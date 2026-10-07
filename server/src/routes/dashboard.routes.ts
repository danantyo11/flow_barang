import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const role = user.roleName;

    // Common counts
    const totalPr = await prisma.purchaseRequest.count();
    const totalPo = await prisma.purchaseOrder.count();

    // Procurement value
    const pos = await prisma.purchaseOrder.findMany({
      where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
      select: { totalAmount: true, status: true, poDate: true, supplierId: true },
    });
    const totalProcurementValue = pos.reduce((sum, p) => sum + p.totalAmount, 0);

    // Stock analysis
    const items = await prisma.item.findMany({
      include: { stockBalances: true },
    });

    let criticalStockCount = 0;
    let lowStockCount = 0;
    let totalStockItems = 0;

    items.forEach((it) => {
      const totalStock = it.stockBalances.reduce((sum, b) => sum + b.quantity, 0);
      if (totalStock <= it.criticalStock) {
        criticalStockCount++;
      } else if (totalStock <= it.minimumStock) {
        lowStockCount++;
      }
      totalStockItems += totalStock;
    });

    // Pending approvals
    const pendingApprovalsCount = await prisma.approvalInstance.count({
      where: { status: 'PENDING' },
    });

    // Outstanding POs (Sent or Partially Received)
    const outstandingPoCount = await prisma.purchaseOrder.count({
      where: { status: { in: ['SENT', 'PARTIALLY_RECEIVED', 'APPROVED'] } },
    });

    // Role-specific stats payload
    let roleSpecific: any = {};

    if (role === 'ADMIN') {
      roleSpecific = {
        totalPr,
        totalPo,
        totalProcurementValue,
        pendingApprovalsCount,
        outstandingPoCount,
        criticalStockCount,
        lowStockCount,
        totalStockItems,
      };
    } else if (role === 'PURCHASING') {
      const prWaitingSourcing = await prisma.purchaseRequest.count({
        where: { status: { in: ['WAITING_PRICE', 'PROCUREMENT'] } },
      });
      const prWaitingPo = await prisma.purchaseRequest.count({
        where: { status: 'WAITING_PO' },
      });
      const poWaitingApproval = await prisma.purchaseOrder.count({
        where: { status: 'WAITING_APPROVAL' },
      });
      const openPo = await prisma.purchaseOrder.count({
        where: { status: { in: ['SENT', 'PARTIALLY_RECEIVED'] } },
      });

      roleSpecific = {
        prWaitingSourcing,
        prWaitingPo,
        poWaitingApproval,
        openPo,
        outstandingPoCount,
        totalPo,
      };
    } else if (role === 'WAREHOUSE') {
      const pendingStockCheck = await prisma.purchaseRequest.count({
        where: { status: { in: ['WAITING_WAREHOUSE_CHECK', 'SUBMITTED'] } },
      });
      const pendingReceiving = await prisma.purchaseOrder.count({
        where: { status: { in: ['SENT', 'PARTIALLY_RECEIVED'] } },
      });
      const pendingHandover = await prisma.purchaseRequest.count({
        where: { status: { in: ['WAITING_HANDOVER', 'STOCK_ISSUE'] } },
      });

      roleSpecific = {
        pendingStockCheck,
        pendingReceiving,
        pendingHandover,
        criticalStockCount,
        lowStockCount,
        totalStockItems,
      };
    } else if (role === 'REQUESTER') {
      const myPr = await prisma.purchaseRequest.count({ where: { requesterId: user.id } });
      const myPendingPr = await prisma.purchaseRequest.count({
        where: {
          requesterId: user.id,
          status: { in: ['DRAFT', 'SUBMITTED', 'WAITING_WAREHOUSE_CHECK', 'WAITING_PRICE', 'WAITING_PO', 'WAITING_APPROVAL'] },
        },
      });
      const myReadyPickup = await prisma.purchaseRequest.count({
        where: { requesterId: user.id, status: { in: ['WAITING_HANDOVER', 'STOCK_ISSUE'] } },
      });
      const myCompleted = await prisma.purchaseRequest.count({
        where: { requesterId: user.id, status: 'COMPLETED' },
      });

      roleSpecific = {
        myPr,
        myPendingPr,
        myReadyPickup,
        myCompleted,
      };
    } else if (role === 'MANAGEMENT' || role === 'APPROVER') {
      // Department spending breakdown
      const prsWithDepts = await prisma.purchaseRequest.findMany({
        where: { purchaseOrders: { some: {} } },
        include: {
          department: true,
          purchaseOrders: true,
        },
      });

      const deptSpending: Record<string, number> = {};
      prsWithDepts.forEach((pr) => {
        const deptName = pr.department.departmentName;
        const total = pr.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
        deptSpending[deptName] = (deptSpending[deptName] || 0) + total;
      });

      roleSpecific = {
        totalProcurementValue,
        outstandingPoCount,
        pendingApprovalsCount,
        criticalStockCount,
        deptSpending,
      };
    }

    return res.json({
      success: true,
      data: {
        role,
        roleSpecific,
        summary: {
          totalPr,
          totalPo,
          totalProcurementValue,
          criticalStockCount,
          lowStockCount,
          pendingApprovalsCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

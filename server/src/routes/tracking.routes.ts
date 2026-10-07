import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/tracking/search?q=... - Quick search or list tracking items
router.get('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim();
    const user = req.user!;

    const where: any = {};
    if (user.roleName === 'REQUESTER') {
      where.requesterId = user.id;
    }

    if (q) {
      where.OR = [
        { prNumber: { contains: q } },
        { purpose: { contains: q } },
        { purchaseOrders: { some: { poNumber: { contains: q } } } },
      ];
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, employeeNumber: true } },
        department: { select: { id: true, departmentName: true, departmentCode: true } },
        items: {
          include: {
            item: { select: { id: true, itemCode: true, itemName: true } },
            unit: { select: { id: true, code: true, name: true } },
          },
        },
        purchaseOrders: {
          select: { id: true, poNumber: true, status: true, totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({ success: true, data: prs });
  } catch (error) {
    next(error);
  }
});

// GET /api/tracking/:documentNumberOrId - Full end-to-end tracking timeline and status
router.get('/:identifier', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifierStr = String(req.params.identifier);
    const user = req.user!;

    // 1. Identify which document it is: PR, PO, GR, GI, or HO
    let prId: string | null = null;

    // Try finding by PR id or PR number
    const prCheck = await prisma.purchaseRequest.findFirst({
      where: {
        OR: [{ id: identifierStr }, { prNumber: identifierStr }],
      },
    });

    if (prCheck) {
      prId = prCheck.id;
    } else {
      // Try PO
      const poCheck = await prisma.purchaseOrder.findFirst({
        where: {
          OR: [{ id: identifierStr }, { poNumber: identifierStr }],
        },
      });
      if (poCheck && poCheck.prId) {
        prId = poCheck.prId;
      } else {
        // Try GR
        const grCheck = await prisma.goodsReceipt.findFirst({
          where: {
            OR: [{ id: identifierStr }, { grNumber: identifierStr }],
          },
        });
        if (grCheck && grCheck.poId) {
          const poFromGr = await prisma.purchaseOrder.findUnique({
            where: { id: grCheck.poId },
          });
          if (poFromGr && poFromGr.prId) {
            prId = poFromGr.prId;
          }
        } else {
          // Try GI
          const giCheck = await prisma.goodsIssue.findFirst({
            where: {
              OR: [{ id: identifierStr }, { giNumber: identifierStr }],
            },
          });
          if (giCheck && giCheck.prId) {
            prId = giCheck.prId;
          } else {
            // Try Handover
            const hoCheck = await prisma.handoverDocument.findFirst({
              where: {
                OR: [{ id: identifierStr }, { hoNumber: identifierStr }],
              },
            });
            if (hoCheck && hoCheck.prId) {
              prId = hoCheck.prId;
            }
          }
        }
      }
    }

    if (!prId) {
      return res.status(404).json({
        success: false,
        message: `Dokumen dengan nomor atau ID '${identifierStr}' tidak ditemukan`,
      });
    }

    // Fetch full PR cluster
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: {
        requester: { select: { id: true, name: true, employeeNumber: true, email: true } },
        department: true,
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
        quotations: {
          include: { supplier: true, items: true },
          orderBy: { createdAt: 'asc' },
        },
        purchaseOrders: {
          include: {
            supplier: true,
            items: { include: { item: true, unit: true } },
            goodsReceipts: {
              include: {
                items: { include: { item: true, warehouse: true, location: true } },
                handovers: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        goodsIssues: {
          include: {
            warehouse: true,
            items: { include: { item: true, unit: true } },
            handovers: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        handovers: {
          include: {
            items: { include: { item: true, unit: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pr) {
      return res.status(404).json({ success: false, message: 'Permintaan barang tidak ditemukan' });
    }

    // If requester, ensure ownership
    if (user.roleName === 'REQUESTER' && pr.requesterId !== user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke tracking PR ini' });
    }

    // Fetch related approval instances & logs
    const poIds = pr.purchaseOrders.map((p) => p.id);
    const approvals = await prisma.approvalInstance.findMany({
      where: {
        OR: [
          { documentType: 'PR', documentId: pr.id },
          { documentType: 'PO', documentId: { in: poIds } },
        ],
      },
      include: {
        logs: {
          include: { approver: { select: { id: true, name: true, employeeNumber: true } } },
          orderBy: { actedAt: 'asc' },
        },
      },
    });

    // Fetch audit trails related to PR and all connected document numbers
    const relevantDocNumbers = [
      pr.prNumber,
      ...pr.purchaseOrders.map((p) => p.poNumber),
      ...pr.purchaseOrders.flatMap((p) => p.goodsReceipts.map((g) => g.grNumber)),
      ...pr.goodsIssues.map((g) => g.giNumber),
      ...pr.handovers.map((h) => h.hoNumber),
    ].filter(Boolean);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        documentNumber: { in: relevantDocNumbers },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build Step Milestones Progression (7 Key Lifecycle Stages)
    // 1. PR Created
    // 2. Warehouse Stock Check
    // 3. Purchasing & Quotation Sourcing
    // 4. Purchase Order Issued & Approved
    // 5. Goods Receipt & Quality Check (Warehouse)
    // 6. Goods Issue / Stock Allocation
    // 7. Handover to Requester & Completed

    const hasWarehouseCheck = !['DRAFT', 'SUBMITTED', 'WAITING_WAREHOUSE_CHECK'].includes(pr.status);
    const hasQuotations = pr.quotations.length > 0;
    const hasPOs = pr.purchaseOrders.length > 0;
    const allPOsApproved = hasPOs && pr.purchaseOrders.every((p) => ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(p.status));
    const allPOsSent = hasPOs && pr.purchaseOrders.some((p) => ['SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(p.status));
    
    const allReceipts = pr.purchaseOrders.flatMap((p) => p.goodsReceipts);
    const hasGoodsReceipt = allReceipts.length > 0;
    const qcPassed = hasGoodsReceipt && allReceipts.some((g) => ['PASSED', 'QC_PASSED', 'POSTED'].includes(g.qcStatus) || g.status === 'POSTED');

    const hasGoodsIssue = pr.goodsIssues.length > 0;
    const hasHandover = pr.handovers.length > 0;
    const isCompleted = pr.status === 'COMPLETED' || pr.handovers.some((h) => h.status === 'COMPLETED');

    const isRejected = pr.status === 'REJECTED' || pr.purchaseOrders.some((p) => p.status === 'REJECTED');
    const isCancelled = pr.status === 'CANCELLED' || pr.purchaseOrders.some((p) => p.status === 'CANCELLED');

    const totalRequested = pr.items.reduce((s, it) => s + it.requestedQty, 0);
    const totalAllocated = pr.items.reduce((s, it) => s + it.allocatedQty, 0);
    const totalPurchase = pr.items.reduce((s, it) => s + it.purchaseQty, 0);

    // Compute progress percentage (0 - 100%)
    let progressPercentage = 15; // Started with PR
    if (hasWarehouseCheck) progressPercentage = 30;
    if (hasQuotations || hasPOs) progressPercentage = 45;
    if (allPOsApproved) progressPercentage = 60;
    if (allPOsSent) progressPercentage = 70;
    if (hasGoodsReceipt || hasGoodsIssue) progressPercentage = 85;
    if (hasHandover) progressPercentage = 95;
    if (isCompleted) progressPercentage = 100;
    if (isCancelled || isRejected) progressPercentage = 100;

    const milestones = [
      {
        id: 'STEP_PR',
        stepNumber: 1,
        title: 'Pengajuan Permintaan (PR)',
        subtitle: `Diajukan oleh ${pr.requester.name} (${pr.department.departmentName})`,
        status: pr.status === 'DRAFT' ? 'IN_PROGRESS' : 'COMPLETED',
        date: pr.requestDate,
        documentNumber: pr.prNumber,
        details: `${pr.items.length} jenis barang requested`,
      },
      {
        id: 'STEP_WAREHOUSE_CHECK',
        stepNumber: 2,
        title: 'Pemeriksaan Stok Gudang',
        subtitle: hasWarehouseCheck
          ? `Alokasi Gudang: ${totalAllocated} | Perlu Beli: ${totalPurchase}`
          : 'Menunggu verifikasi fisik & stok gudang',
        status: hasWarehouseCheck ? 'COMPLETED' : pr.status === 'WAITING_WAREHOUSE_CHECK' ? 'IN_PROGRESS' : 'PENDING',
        date: hasWarehouseCheck ? pr.updatedAt : null,
        details: hasWarehouseCheck
          ? totalPurchase === 0
            ? '100% Tersedia di Stok Gudang'
            : totalAllocated > 0
            ? 'Stok Parsial (Sebagian Gudang, Sebagian Pembelian)'
            : 'Stok Kosong (Diteruskan ke Purchasing)'
          : null,
      },
      {
        id: 'STEP_SOURCING',
        stepNumber: 3,
        title: 'Sourcing & Cek Harga',
        subtitle: hasQuotations
          ? `${pr.quotations.length} penawaran supplier diterima`
          : totalPurchase === 0 && hasWarehouseCheck
          ? 'Dilewati (Stok gudang mencukupi)'
          : 'Purchasing mencari penawaran vendor terbaik',
        status:
          totalPurchase === 0 && hasWarehouseCheck
            ? 'SKIPPED'
            : hasPOs || hasQuotations
            ? 'COMPLETED'
            : ['WAITING_PRICE', 'PROCUREMENT'].includes(pr.status)
            ? 'IN_PROGRESS'
            : 'PENDING',
        details: hasQuotations
          ? `Vendor terpilih: ${pr.quotations.find((q) => q.isSelected)?.supplier.supplierName || 'Dalam review'}`
          : null,
      },
      {
        id: 'STEP_PO_APPROVAL',
        stepNumber: 4,
        title: 'Purchase Order & Approval',
        subtitle: hasPOs
          ? `${pr.purchaseOrders.map((p) => p.poNumber).join(', ')} (${allPOsApproved ? 'Approved' : 'Menunggu Approval'})`
          : totalPurchase === 0 && hasWarehouseCheck
          ? 'Dilewati (Tidak ada pengadaan eksternal)'
          : 'Penerbitan PO dan persetujuan bertingkat pimpinan',
        status:
          totalPurchase === 0 && hasWarehouseCheck
            ? 'SKIPPED'
            : allPOsApproved
            ? 'COMPLETED'
            : hasPOs
            ? 'IN_PROGRESS'
            : 'PENDING',
        details: hasPOs ? `Total Nilai: Rp ${pr.purchaseOrders.reduce((s, p) => s + p.totalAmount, 0).toLocaleString('id-ID')}` : null,
      },
      {
        id: 'STEP_RECEIVING',
        stepNumber: 5,
        title: 'Penerimaan Gudang & QC',
        subtitle: hasGoodsReceipt
          ? `${allReceipts.map((r) => r.grNumber).join(', ')} (QC: ${qcPassed ? 'Lolos / Passed' : 'Dalam QC'})`
          : totalPurchase === 0 && hasWarehouseCheck
          ? 'Dilewati (Barang langsung dari stok gudang)'
          : 'Pengiriman vendor & inspeksi kualitas barang',
        status:
          totalPurchase === 0 && hasWarehouseCheck
            ? 'SKIPPED'
            : qcPassed
            ? 'COMPLETED'
            : hasGoodsReceipt
            ? 'IN_PROGRESS'
            : allPOsSent
            ? 'WAITING_ARRIVAL'
            : 'PENDING',
        details: hasGoodsReceipt ? `Diterima oleh: ${allReceipts[0]?.receivedBy}` : null,
      },
      {
        id: 'STEP_HANDOVER',
        stepNumber: 6,
        title: 'Pengeluaran & Serah Terima User',
        subtitle: isCompleted
          ? `Selesai diserahterimakan kepada ${pr.handovers[0]?.receiverName || pr.requester.name}`
          : hasHandover
          ? 'Dokumen serah terima telah terbit, menunggu tanda tangan penerima'
          : hasGoodsIssue
          ? 'Barang telah dikeluarkan dari rak gudang'
          : 'Penyerahan fisik barang kepada pemohon',
        status: isCompleted ? 'COMPLETED' : hasHandover || hasGoodsIssue ? 'IN_PROGRESS' : 'PENDING',
        date: pr.handovers[0]?.handoverDate || null,
        documentNumber: pr.handovers[0]?.hoNumber || pr.goodsIssues[0]?.giNumber || null,
      },
    ];

    return res.json({
      success: true,
      data: {
        pr,
        progressPercentage,
        isCompleted,
        isCancelled,
        isRejected,
        milestones,
        approvals,
        auditLogs,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

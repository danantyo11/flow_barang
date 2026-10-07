import { PrismaClient } from '@prisma/client';

export class ApprovalEngine {
  /**
   * Determine matching flow and initialize approval instance for a document (e.g. PO)
   */
  static async initializeApproval(
    prismaClient: PrismaClient | any,
    documentType: 'PO' | 'DIRECT_PURCHASE',
    documentId: string,
    documentNumber: string,
    totalAmount: number
  ) {
    // Find active approval flow matching the total amount
    const flows = await prismaClient.approvalFlow.findMany({
      where: { isActive: true },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: { role: true },
        },
      },
    });

    let matchedFlow = flows.find((f: any) => {
      const minOk = totalAmount >= f.minAmount;
      const maxOk = f.maxAmount === null || totalAmount <= f.maxAmount;
      return minOk && maxOk;
    });

    // Fallback to flow with largest minAmount or first flow
    if (!matchedFlow && flows.length > 0) {
      matchedFlow = flows[0];
    }

    const totalSteps = matchedFlow?.steps.length || 1;

    // Create Approval Instance
    const instance = await prismaClient.approvalInstance.create({
      data: {
        documentType,
        documentId,
        documentNumber,
        currentStep: 1,
        totalSteps,
        status: 'PENDING',
      },
    });

    return {
      instance,
      flow: matchedFlow,
    };
  }

  /**
   * Process an approval action (APPROVE, REJECT, REVISION_REQUIRED)
   */
  static async processAction(
    prismaClient: PrismaClient | any,
    instanceId: string,
    approverId: string,
    action: 'APPROVE' | 'REJECT' | 'REVISION_REQUIRED',
    comments?: string
  ) {
    const instance = await prismaClient.approvalInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new Error('Approval instance tidak ditemukan');
    }

    if (instance.status !== 'PENDING') {
      throw new Error(`Dokumen sudah tidak dalam status PENDING (status: ${instance.status})`);
    }

    // Record the approval log
    await prismaClient.approvalLog.create({
      data: {
        instanceId,
        stepOrder: instance.currentStep,
        approverId,
        action,
        comments,
      },
    });

    let newStatus = instance.status;
    let nextStep = instance.currentStep;

    if (action === 'APPROVE') {
      if (instance.currentStep >= instance.totalSteps) {
        newStatus = 'APPROVED';
      } else {
        nextStep = instance.currentStep + 1;
        newStatus = 'PENDING';
      }
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
    } else if (action === 'REVISION_REQUIRED') {
      newStatus = 'REVISION_REQUIRED';
    }

    const updatedInstance = await prismaClient.approvalInstance.update({
      where: { id: instanceId },
      data: {
        currentStep: nextStep,
        status: newStatus,
      },
    });

    return updatedInstance;
  }
}

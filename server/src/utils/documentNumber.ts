import { PrismaClient } from '@prisma/client';

export type DocumentPrefix = 'PR' | 'PO' | 'GR' | 'GI' | 'HO' | 'DP';

/**
 * Generates an atomic sequential document number (e.g. PR-202610-0001)
 * Uses database sequence locking to prevent race conditions when concurrent requests happen.
 */
export async function generateDocumentNumber(
  prismaClient: PrismaClient | any,
  prefix: DocumentPrefix
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}${month}`;

  const sequenceRecord = await prismaClient.documentSequence.upsert({
    where: {
      prefix_yearMonth: {
        prefix,
        yearMonth,
      },
    },
    update: {
      lastSequence: {
        increment: 1,
      },
    },
    create: {
      prefix,
      yearMonth,
      lastSequence: 1,
    },
  });

  const seqNumber = String(sequenceRecord.lastSequence).padStart(4, '0');
  return `${prefix}-${yearMonth}-${seqNumber}`;
}

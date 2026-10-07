import { PrismaClient } from '@prisma/client';

export interface AuditLogParams {
  userId?: string;
  userName: string;
  action: string;
  module: string;
  documentNumber?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(
    prismaClient: PrismaClient | any,
    params: AuditLogParams
  ) {
    try {
      await prismaClient.auditLog.create({
        data: {
          userId: params.userId || null,
          userName: params.userName || 'System',
          action: params.action,
          module: params.module,
          documentNumber: params.documentNumber || null,
          oldValue: params.oldValue ? (typeof params.oldValue === 'string' ? params.oldValue : JSON.stringify(params.oldValue)) : null,
          newValue: params.newValue ? (typeof params.newValue === 'string' ? params.newValue : JSON.stringify(params.newValue)) : null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
}

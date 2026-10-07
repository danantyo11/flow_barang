import { PrismaClient } from '@prisma/client';

export class NotificationService {
  /**
   * Send notification to a specific user or an entire role
   */
  static async notify(
    prismaClient: PrismaClient | any,
    params: {
      userId?: string;
      roleName?: string;
      title: string;
      message: string;
      link?: string;
    }
  ) {
    try {
      let roleId: string | undefined = undefined;

      if (params.roleName) {
        const role = await prismaClient.role.findUnique({
          where: { name: params.roleName },
        });
        roleId = role?.id;
      }

      await prismaClient.notification.create({
        data: {
          userId: params.userId || null,
          roleId: roleId || null,
          title: params.title,
          message: params.message,
          link: params.link || null,
          isRead: false,
        },
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }
}

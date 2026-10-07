import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

export interface AuthenticatedUser {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  departmentId?: string | null;
  departmentName?: string | null;
  roleName: string;
  position?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token autentikasi tidak ditemukan.',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'golden_procurement_jwt_secret_key_2026_super_secure';

    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: true,
        department: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak aktif atau tidak ditemukan.',
      });
    }

    req.user = {
      id: user.id,
      employeeNumber: user.employeeNumber,
      name: user.name,
      email: user.email,
      departmentId: user.departmentId,
      departmentName: user.department?.departmentName || null,
      roleName: user.role.name,
      position: user.position,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Sesi kedaluwarsa atau token tidak valid.',
    });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autentikasi diperlukan.',
      });
    }

    // ADMIN has universal bypass
    if (req.user.roleName === 'ADMIN' || allowedRoles.includes(req.user.roleName)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Akses ditolak. Peran '${req.user.roleName}' tidak memiliki izin untuk tindakan ini.`,
    });
  };
};

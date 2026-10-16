import { Request, Response, NextFunction } from 'express';
import { RoleCode } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role_code: string;
    role_level: number;
    department_id: number;
  };
}

/**
 * Middleware: Verify user is authenticated
 */
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Skeleton: in production, verify JWT bearer token from req.headers.authorization
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Authentication token required.' });
  }

  // Simulated decoded payload for architecture demonstration:
  // req.user = decodedToken;
  next();
};

/**
 * Middleware: Exclusive check for SYST000 (Superadmin)
 */
export const requireSYST000 = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role_code !== RoleCode.SYST000) {
    return res.status(403).json({
      success: false,
      message: 'Akses Ditolak: Modul ini hanya dapat diakses oleh Admin Sistem (SYST000).'
    });
  }
  next();
};

/**
 * Middleware: Verify Minimum Role Level (e.g. Level >= 6 for PO Approval)
 */
export const requireMinRoleLevel = (minLevel: number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role_level < minLevel) {
      return res.status(403).json({
        success: false,
        message: `Akses Ditolak: Otorisasi membutuhkan peran minimal Level ${minLevel} (Manager ke atas).`
      });
    }
    next();
  };
};

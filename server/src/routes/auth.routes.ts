import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuditService } from '../services/auditService.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        department: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Email atau kata sandi tidak valid.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau kata sandi tidak valid.',
      });
    }

    const secret = process.env.JWT_SECRET || 'golden_procurement_jwt_secret_key_2026_super_secure';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      { userId: user.id },
      secret,
      { expiresIn: expiresIn as any }
    );

    await AuditService.log(prisma, {
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      module: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        employeeNumber: user.employeeNumber,
        name: user.name,
        email: user.email,
        departmentId: user.departmentId,
        departmentName: user.department?.departmentName || null,
        roleName: user.role.name,
        position: user.position,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

// GET /api/auth/users
router.get('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true,
        department: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        employeeNumber: u.employeeNumber,
        name: u.name,
        email: u.email,
        phone: u.phone,
        department: u.department?.departmentName || '-',
        departmentId: u.departmentId,
        position: u.position,
        role: u.role.name,
        roleId: u.roleId,
        status: u.status,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/roles
router.get('/roles', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    return res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/departments
router.get('/departments', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({ orderBy: { departmentName: 'asc' } });
    return res.json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
});

export default router;

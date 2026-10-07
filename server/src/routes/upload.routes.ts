import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.xlsx', '.csv', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe berkas tidak didukung: ${ext}`));
    }
  },
});

// POST /api/upload
router.post(
  '/',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah' });
      }

      const { documentType, documentId } = req.body;

      const attachment = await prisma.attachment.create({
        data: {
          documentType: documentType || 'GENERAL',
          documentId: documentId || 'GENERAL',
          fileName: req.file.filename,
          originalName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          filePath: `/uploads/${req.file.filename}`,
          uploadedBy: req.user?.name,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Berkas berhasil diunggah',
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/upload/attachments/:docType/:docId
router.get(
  '/attachments/:docType/:docId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attachments = await prisma.attachment.findMany({
        where: {
          documentType: req.params.docType as string,
          documentId: req.params.docId as string,
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

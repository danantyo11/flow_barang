import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth.routes.js';
import itemsRoutes from './routes/items.routes.js';
import warehousesRoutes from './routes/warehouses.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import prRoutes from './routes/pr.routes.js';
import poRoutes from './routes/po.routes.js';
import approvalRoutes from './routes/approval.routes.js';
import receivingRoutes from './routes/receiving.routes.js';
import goodsIssueRoutes from './routes/goodsIssue.routes.js';
import handoverRoutes from './routes/handover.routes.js';
import directPurchaseRoutes from './routes/directPurchase.routes.js';
import stockRoutes from './routes/stock.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import searchRoutes from './routes/search.routes.js';
import auditRoutes from './routes/audit.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import settingsRoutes from './routes/settings.routes.js';

import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads directory
const uploadsPath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'UP',
    system: 'GOLDEN PROCUREMENT & WAREHOUSE SYSTEM',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchase-requests', prRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/goods-receipts', receivingRoutes);
app.use('/api/goods-issues', goodsIssueRoutes);
app.use('/api/handovers', handoverRoutes);
app.use('/api/direct-purchases', directPurchaseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start server if not running in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Golden Procurement API] Running on http://localhost:${PORT}`);
    console.log(`[Golden Procurement API] Health check at http://localhost:${PORT}/api/health`);
  });
}

export default app;

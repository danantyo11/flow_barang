import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { OfflineProvider } from './context/OfflineContext.js';
import { AppLayout } from './components/layout/AppLayout.js';

// Pages
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { PRListPage } from './pages/PRListPage.js';
import { PRCreatePage } from './pages/PRCreatePage.js';
import { PRDetailPage } from './pages/PRDetailPage.js';
import { WarehouseCheckPage } from './pages/WarehouseCheckPage.js';
import { PurchasingPage } from './pages/PurchasingPage.js';
import { POListPage } from './pages/POListPage.js';
import { POCreatePage } from './pages/POCreatePage.js';
import { PODetailPage } from './pages/PODetailPage.js';
import { ApprovalListPage } from './pages/ApprovalListPage.js';
import { ReceivingListPage } from './pages/ReceivingListPage.js';
import { ReceivingCreatePage } from './pages/ReceivingCreatePage.js';
import { GoodsIssuePage } from './pages/GoodsIssuePage.js';
import { HandoverPage } from './pages/HandoverPage.js';
import { DirectPurchasePage } from './pages/DirectPurchasePage.js';
import { StockBalancesPage } from './pages/StockBalancesPage.js';
import { StockCardPage } from './pages/StockCardPage.js';
import { MasterDataPage } from './pages/MasterDataPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { AuditTrailPage } from './pages/AuditTrailPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Memeriksa autentikasi...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Procurement */}
              <Route path="purchase-requests" element={<PRListPage />} />
              <Route path="purchase-requests/new" element={<PRCreatePage />} />
              <Route path="purchase-requests/:id" element={<PRDetailPage />} />
              <Route path="warehouse-check" element={<WarehouseCheckPage />} />
              <Route path="warehouse-check/:prId" element={<WarehouseCheckPage />} />
              <Route path="purchasing" element={<PurchasingPage />} />
              <Route path="purchasing/quotations" element={<PurchasingPage />} />
              <Route path="purchase-orders" element={<POListPage />} />
              <Route path="purchase-orders/new" element={<POCreatePage />} />
              <Route path="purchase-orders/:id" element={<PODetailPage />} />
              <Route path="approvals" element={<ApprovalListPage />} />
              <Route path="direct-purchases" element={<DirectPurchasePage />} />

              {/* Warehouse */}
              <Route path="goods-receipts" element={<ReceivingListPage />} />
              <Route path="goods-receipts/new" element={<ReceivingCreatePage />} />
              <Route path="goods-issues" element={<GoodsIssuePage />} />
              <Route path="goods-issues/new" element={<GoodsIssuePage />} />
              <Route path="handovers" element={<HandoverPage />} />
              <Route path="handovers/:id" element={<HandoverPage />} />
              <Route path="stock" element={<StockBalancesPage />} />
              <Route path="stock-card" element={<StockCardPage />} />

              {/* Master Data */}
              <Route path="master/items" element={<MasterDataPage />} />
              <Route path="master/categories" element={<MasterDataPage />} />
              <Route path="master/suppliers" element={<MasterDataPage />} />
              <Route path="master/warehouses" element={<MasterDataPage />} />
              <Route path="master/users" element={<MasterDataPage />} />

              {/* Reports & System */}
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit-trail" element={<AuditTrailPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </OfflineProvider>
    </AuthProvider>
  );
}

export default App;

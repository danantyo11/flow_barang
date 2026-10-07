import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import {
  FileText,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  Boxes,
  DollarSign,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setData(res.data.data);
    } catch (e) {
      console.error('Failed to load dashboard stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-900/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Role: {user?.roleName}
            </span>
            <span className="text-xs text-slate-400">
              {user?.departmentName ? `Divisi ${user.departmentName}` : 'All Departments'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-2">
            Selamat Datang, {user?.name}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Sistem Terpadu Golden Procurement & Warehouse: Kontrol alur permintaan barang, cek stok gudang, quotation, PO, approval pimpinan, receiving & serah terima.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.roleName === 'REQUESTER' && (
            <button
              onClick={() => navigate('/purchase-requests/new')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition"
            >
              + Buat Permintaan Barang (PR)
            </button>
          )}
          {user?.roleName === 'WAREHOUSE' && (
            <button
              onClick={() => navigate('/warehouse-check')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              Cek Stok Gudang
            </button>
          )}
          {user?.roleName === 'PURCHASING' && (
            <button
              onClick={() => navigate('/purchasing')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              Proses Sourcing & PO
            </button>
          )}
          {user?.roleName === 'APPROVER' && (
            <button
              onClick={() => navigate('/approvals')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              Tinjau Approval Pending
            </button>
          )}
        </div>
      </div>

      {/* Demo Workflow Section 42 Highlight Card */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Demo Workflow Berhasil (Section 42)
              </span>
              <StatusBadge status="COMPLETED" />
            </div>
            <p className="text-xs text-amber-800 mt-1">
              <strong>PR-202610-0001</strong> (Maintenance) → Bearing 6204ZZ (10 pcs) → Cek Stok: 0 → Vendor A: Rp 2.500.000 → PO-202610-0001 → Approved → GR-202610-0001 → HO-202610-0001 Selesai diserahterimakan.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/purchase-requests')}
          className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 flex-shrink-0"
        >
          Lihat Dokumen <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total PR</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {data?.summary?.totalPr || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Permintaan Barang</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total PO</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {data?.summary?.totalPo || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Purchase Order Diterbitkan</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Approval</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {data?.summary?.pendingApprovalsCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Menunggu Persetujuan</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nilai Pengadaan</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-2 truncate">
            {formatCurrency(data?.summary?.totalProcurementValue || 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Total Transaksi PO</p>
        </div>
      </div>

      {/* Stock Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-800">Status Stok Kritis & Minimum</h3>
            </div>
            <button
              onClick={() => navigate('/stock')}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              Lihat Semua Stok
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-xs font-medium text-rose-700">Barang Critical Level</span>
              <div className="text-2xl font-extrabold text-rose-800 mt-1">
                {data?.summary?.criticalStockCount || 0}
              </div>
              <p className="text-[10px] text-rose-600 mt-0.5">Termasuk Kowi & item kritis</p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-xs font-medium text-amber-700">Low Stock Level</span>
              <div className="text-2xl font-extrabold text-amber-800 mt-1">
                {data?.summary?.lowStockCount || 0}
              </div>
              <p className="text-[10px] text-amber-600 mt-0.5">Mendekati reorder point</p>
            </div>
          </div>
        </div>

        {/* Workflow Quick Links */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Jalur Cepat Alur Pengadaan</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => navigate('/purchase-requests')}
              className="p-3 text-left border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              <span className="font-bold text-slate-800 block">1. Permintaan Barang</span>
              <span className="text-[11px] text-slate-500">Pengajuan PR divisi</span>
            </button>
            <button
              onClick={() => navigate('/warehouse-check')}
              className="p-3 text-left border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              <span className="font-bold text-slate-800 block">2. Cek Gudang</span>
              <span className="text-[11px] text-slate-500">Pemisahan stok & beli</span>
            </button>
            <button
              onClick={() => navigate('/purchasing')}
              className="p-3 text-left border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              <span className="font-bold text-slate-800 block">3. Purchasing & Quotation</span>
              <span className="text-[11px] text-slate-500">Komparasi vendor & PO</span>
            </button>
            <button
              onClick={() => navigate('/goods-receipts')}
              className="p-3 text-left border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              <span className="font-bold text-slate-800 block">4. Receiving & QC</span>
              <span className="text-[11px] text-slate-500">Inspeksi & stok gudang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { Plus, Search, ShoppingCart, ChevronRight, FileText } from 'lucide-react';

export const POListPage: React.FC = () => {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchPOs = async () => {
    setLoading(true);
    try {
      let query = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/purchase-orders${query}`);
      setPos(res.data.data || []);
    } catch (e) {
      console.error('Failed to load POs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [statusFilter]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  const filteredPOs = pos.filter((po) => {
    const q = searchTerm.toLowerCase();
    return (
      po.poNumber?.toLowerCase().includes(q) ||
      po.supplier?.supplierName?.toLowerCase().includes(q) ||
      po.purchaseRequest?.prNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Purchase Order (PO)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola pesanan pembelian resmi kepada vendor dan tracking penerimaan barang
          </p>
        </div>

        {['ADMIN', 'PURCHASING'].includes(user?.roleName || '') && (
          <button
            onClick={() => navigate('/purchase-orders/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Terbitkan PO Baru
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor PO, supplier, PR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none w-full md:w-auto"
        >
          <option value="">Semua Status PO</option>
          <option value="DRAFT">DRAFT</option>
          <option value="WAITING_APPROVAL">WAITING APPROVAL</option>
          <option value="APPROVED">APPROVED</option>
          <option value="SENT">SENT (Terkirim ke Vendor)</option>
          <option value="PARTIALLY_RECEIVED">PARTIALLY RECEIVED</option>
          <option value="FULLY_RECEIVED">FULLY RECEIVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data Purchase Order...</div>
        ) : filteredPOs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">No PO</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Supplier / Vendor</th>
                  <th className="px-4 py-3">Ref. PR</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Total Nilai</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3.5 font-bold text-amber-700">
                      {po.poNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(po.poDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {po.supplier?.supplierName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {po.purchaseRequest?.prNumber || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {po.items?.length || 0} item
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada Purchase Order</p>
          </div>
        )}
      </div>
    </div>
  );
};

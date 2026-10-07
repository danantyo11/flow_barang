import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { Plus, PackageCheck, Search, ChevronRight, CheckCircle2 } from 'lucide-react';

export const ReceivingListPage: React.FC = () => {
  const [grs, setGrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchGRs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/goods-receipts');
      setGrs(res.data.data || []);
    } catch (e) {
      console.error('Failed to load GRs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGRs();
  }, []);

  const filtered = grs.filter((g) => {
    const q = searchTerm.toLowerCase();
    return (
      g.grNumber?.toLowerCase().includes(q) ||
      g.purchaseOrder?.poNumber?.toLowerCase().includes(q) ||
      g.supplier?.supplierName?.toLowerCase().includes(q) ||
      g.receivedBy?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Penerimaan Barang (Goods Receiving / GR)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemeriksaan fisik barang datang, inspeksi Quality Check (QC), dan penentuan tujuan stok / serah terima
          </p>
        </div>

        {['ADMIN', 'WAREHOUSE'].includes(user?.roleName || '') && (
          <button
            onClick={() => navigate('/goods-receipts/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            + Terima Barang Baru
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor GR, PO, supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* GR List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data penerimaan barang...</div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">No GR</th>
                  <th className="px-4 py-3">Tanggal Tiba</th>
                  <th className="px-4 py-3">Ref. PO</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Surat Jalan</th>
                  <th className="px-4 py-3">Penerima</th>
                  <th className="px-4 py-3">Destinasi</th>
                  <th className="px-4 py-3">Status QC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 font-bold text-emerald-800">
                      {g.grNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(g.arrivalDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {g.purchaseOrder?.poNumber || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {g.supplier?.supplierName || g.purchaseOrder?.supplier?.supplierName || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {g.deliveryNoteNumber || '-'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {g.receivedBy}
                    </td>
                    <td className="px-4 py-3.5 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${g.destination === 'STOCK' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {g.destination === 'STOCK' ? '📦 Masuk Stok' : '👤 Handover User'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={g.qcStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada data penerimaan barang</p>
          </div>
        )}
      </div>
    </div>
  );
};

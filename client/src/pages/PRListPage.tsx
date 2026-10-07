import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { Plus, Search, Filter, FileText, ChevronRight, AlertCircle, Clock } from 'lucide-react';

export const PRListPage: React.FC = () => {
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchPrs = async () => {
    setLoading(true);
    try {
      let query = '';
      const params: string[] = [];
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (priorityFilter) params.push(`priority=${priorityFilter}`);
      if (params.length > 0) query = `?${params.join('&')}`;

      const res = await api.get(`/purchase-requests${query}`);
      setPrs(res.data.data || []);
    } catch (e) {
      console.error('Failed to load PRs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrs();
  }, [statusFilter, priorityFilter]);

  const filteredPrs = prs.filter((pr) => {
    const q = searchTerm.toLowerCase();
    return (
      pr.prNumber?.toLowerCase().includes(q) ||
      pr.purpose?.toLowerCase().includes(q) ||
      pr.requester?.name?.toLowerCase().includes(q) ||
      pr.department?.departmentName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Permintaan Barang (PR)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola pengajuan kebutuhan barang dari divisi sebelum dilakukan cek stok dan pembelian
          </p>
        </div>

        {['ADMIN', 'REQUESTER'].includes(user?.roleName || '') && (
          <button
            onClick={() => navigate('/purchase-requests/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Buat Permintaan Baru
          </button>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor PR, divisi, pemohon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">DRAFT</option>
            <option value="WAITING_WAREHOUSE_CHECK">WAITING WAREHOUSE CHECK</option>
            <option value="STOCK_ISSUE">STOCK ISSUE</option>
            <option value="PARTIAL_STOCK">PARTIAL STOCK</option>
            <option value="WAITING_PRICE">WAITING PRICE</option>
            <option value="WAITING_PO">WAITING PO</option>
            <option value="WAITING_APPROVAL">WAITING APPROVAL</option>
            <option value="ORDERED">ORDERED</option>
            <option value="PARTIALLY_RECEIVED">PARTIALLY RECEIVED</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="WAITING_HANDOVER">WAITING HANDOVER</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none"
          >
            <option value="">Semua Prioritas</option>
            <option value="NORMAL">NORMAL</option>
            <option value="URGENT">URGENT</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
      </div>

      {/* PR Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data permintaan...</div>
        ) : filteredPrs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">No PR</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pemohon & Divisi</th>
                  <th className="px-4 py-3">Prioritas</th>
                  <th className="px-4 py-3">Keperluan</th>
                  <th className="px-4 py-3">Jumlah Item</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrs.map((pr) => (
                  <tr
                    key={pr.id}
                    onClick={() => navigate(`/purchase-requests/${pr.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3.5 font-bold text-amber-700">
                      {pr.prNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(pr.requestDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{pr.requester?.name}</div>
                      <div className="text-[10px] text-slate-400">{pr.department?.departmentName}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pr.priority === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : pr.priority === 'URGENT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {pr.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs truncate text-slate-600">
                      {pr.purpose || '-'}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {pr.items?.length || 0} item
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={pr.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tracking?q=${pr.prNumber}`);
                          }}
                          title="Lacak Status Alur"
                          className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg transition"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada Permintaan Barang</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Klik tombol 'Buat Permintaan Baru' untuk mengajukan PR pertama Anda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

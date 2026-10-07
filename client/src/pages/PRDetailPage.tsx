import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import {
  ArrowLeft,
  Calendar,
  Building,
  User,
  CheckCircle,
  Clock,
  ShoppingCart,
  Package,
  Layers,
  Ban,
  Send,
  Boxes
} from 'lucide-react';

export const PRDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pr, setPr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPR = async () => {
    try {
      const res = await api.get(`/purchase-requests/${id}`);
      setPr(res.data.data);
    } catch (e) {
      console.error('Failed to load PR detail', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPR();
  }, [id]);

  const handleSubmitDraft = async () => {
    setActionLoading(true);
    try {
      await api.post(`/purchase-requests/${id}/submit`);
      await fetchPR();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal submit PR');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPR = async () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan Permintaan Barang ini?')) return;
    setActionLoading(true);
    try {
      await api.post(`/purchase-requests/${id}/cancel`);
      await fetchPR();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal membatalkan PR');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat rincian PR...</div>;
  }

  if (!pr) {
    return <div className="p-8 text-center text-xs text-rose-500">Permintaan Barang tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchase-requests')}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{pr.prNumber}</h1>
              <StatusBadge status={pr.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Diajukan pada {new Date(pr.requestDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/tracking?q=${pr.prNumber}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            Lacak Status Alur
          </button>
          {pr.status === 'DRAFT' && ['ADMIN', 'REQUESTER'].includes(user?.roleName || '') && (
            <button
              onClick={handleSubmitDraft}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              Submit ke Gudang
            </button>
          )}

          {pr.status === 'WAITING_WAREHOUSE_CHECK' && ['ADMIN', 'WAREHOUSE'].includes(user?.roleName || '') && (
            <button
              onClick={() => navigate(`/warehouse-check/${pr.id}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Boxes className="w-4 h-4" />
              Lakukan Cek Stok Gudang
            </button>
          )}

          {['WAITING_PRICE', 'PROCUREMENT'].includes(pr.status) && ['ADMIN', 'PURCHASING'].includes(user?.roleName || '') && (
            <button
              onClick={() => navigate(`/purchasing?prId=${pr.id}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <ShoppingCart className="w-4 h-4" />
              Proses Quotation & PO
            </button>
          )}

          {['DRAFT', 'SUBMITTED', 'WAITING_WAREHOUSE_CHECK'].includes(pr.status) && (
            <button
              onClick={handleCancelPR}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition"
            >
              <Ban className="w-4 h-4" />
              Batalkan PR
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Pemohon
          </span>
          <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {pr.requester?.name}
          </div>
          <span className="text-[10px] text-slate-500">{pr.requester?.email}</span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Departemen
          </span>
          <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            {pr.department?.departmentName}
          </div>
          <span className="text-[10px] text-slate-500">Kode: {pr.department?.departmentCode}</span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Prioritas & Tgl Butuh
          </span>
          <div className="font-bold text-slate-800 mt-1">
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
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString('id-ID') : 'Tidak ditentukan'}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Keperluan
          </span>
          <p className="font-medium text-slate-700 mt-1 leading-relaxed">
            {pr.purpose || '-'}
          </p>
        </div>
      </div>

      {/* Items Table with Warehouse Allocation breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Rincian Barang & Alokasi Stok Gudang
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            {pr.items?.length || 0} Item
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Kode & Nama Barang</th>
                <th className="px-4 py-3">Spesifikasi</th>
                <th className="px-4 py-3 text-right">Diminta (Req)</th>
                <th className="px-4 py-3 text-right text-blue-700">Stok Ada</th>
                <th className="px-4 py-3 text-right text-emerald-700">Alokasi Gudang</th>
                <th className="px-4 py-3 text-right text-purple-700">Perlu Beli</th>
                <th className="px-4 py-3">Satuan</th>
                <th className="px-4 py-3">Status Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pr.items?.map((it: any) => (
                <tr key={it.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">{it.item?.itemName}</div>
                    <div className="text-[10px] text-slate-400">{it.item?.itemCode}</div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 max-w-xs">
                    {it.specification || it.item?.specification || '-'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                    {it.requestedQty}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-blue-700">
                    {it.availableStock}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-emerald-700 bg-emerald-50/30">
                    {it.allocatedQty}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-purple-700 bg-purple-50/30">
                    {it.purchaseQty}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-600">
                    {it.unit?.code || it.unit?.name}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={it.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

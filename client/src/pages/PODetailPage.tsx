import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import {
  ArrowLeft,
  Truck,
  Calendar,
  Send,
  CheckCircle,
  FileText,
  Clock,
  PackageCheck,
  Printer
} from 'lucide-react';

export const PODetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPO = async () => {
    try {
      const res = await api.get(`/purchase-orders/${id}`);
      setPo(res.data.data);
    } catch (e) {
      console.error('Failed to load PO', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPO();
  }, [id]);

  const handleSubmitApproval = async () => {
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${id}/submit-approval`);
      alert('PO berhasil diajukan untuk persetujuan pimpinan');
      await fetchPO();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengajukan approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPO = async () => {
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${id}/send`);
      alert('PO ditandai telah dikirim ke Supplier');
      await fetchPO();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengirim PO');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat rincian Purchase Order...</div>;
  }

  if (!po) {
    return <div className="p-8 text-center text-xs text-rose-500">Purchase Order tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchase-orders')}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{po.poNumber}</h1>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Diterbitkan pada {new Date(po.poDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            Cetak Dokumen
          </button>

          {po.status === 'DRAFT' && ['ADMIN', 'PURCHASING'].includes(user?.roleName || '') && (
            <button
              onClick={handleSubmitApproval}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <Send className="w-4 h-4" />
              Ajukan Persetujuan Pimpinan
            </button>
          )}

          {po.status === 'APPROVED' && ['ADMIN', 'PURCHASING'].includes(user?.roleName || '') && (
            <button
              onClick={handleSendPO}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <Send className="w-4 h-4" />
              Tandai Terkirim ke Supplier
            </button>
          )}

          {['SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && ['ADMIN', 'WAREHOUSE'].includes(user?.roleName || '') && (
            <button
              onClick={() => navigate(`/goods-receipts/new?poId=${po.id}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <PackageCheck className="w-4 h-4" />
              Terima Barang (GR)
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Supplier / Vendor
          </span>
          <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-slate-400" />
            {po.supplier?.supplierName}
          </div>
          <span className="text-[10px] text-slate-500">Kode: {po.supplier?.supplierCode}</span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Ref. PR & Pembuat
          </span>
          <div className="font-bold text-slate-900 mt-1">
            {po.purchaseRequest?.prNumber || 'Tanpa PR'}
          </div>
          <span className="text-[10px] text-slate-500">Dibuat oleh: {po.createdBy || '-'}</span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Terms & Pengiriman
          </span>
          <div className="font-semibold text-slate-800 mt-1">
            {po.paymentTerms || 'NET 30'} • {po.shippingTerms || '-'}
          </div>
          <span className="text-[10px] text-slate-500">
            Tenggat: {po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('id-ID') : '-'}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
            Status Persetujuan
          </span>
          <div className="font-bold text-slate-900 mt-1">
            {po.approvedBy ? `Disetujui: ${po.approvedBy}` : 'Belum disetujui'}
          </div>
          <span className="text-[10px] text-slate-500">
            {po.approvedAt ? new Date(po.approvedAt).toLocaleDateString('id-ID') : '-'}
          </span>
        </div>
      </div>

      {/* Approval Timeline / Logs */}
      {po.approvalInstance && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            Riwayat Persetujuan Pimpinan (Approval Engine)
          </h2>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800">
                Tahap Saat Ini: {po.approvalInstance.currentStep} / {po.approvalInstance.totalSteps}
              </span>
              <span className="ml-2 font-semibold text-slate-500">
                (Status: {po.approvalInstance.status})
              </span>
            </div>
          </div>

          {po.approvalInstance.logs?.length > 0 && (
            <div className="space-y-2 pt-2">
              {po.approvalInstance.logs.map((log: any, idx: number) => (
                <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
                    ✓
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {log.approver?.name} ({log.action})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.actedAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{log.comments || 'Disetujui'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PO Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Rincian Barang yang Dipesan
          </h2>
          <span className="text-xs font-semibold text-slate-500">{po.items?.length || 0} Item</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Barang & Spesifikasi</th>
                <th className="px-4 py-3 text-right">Qty Pesan</th>
                <th className="px-4 py-3 text-right text-emerald-700">Qty Diterima</th>
                <th className="px-4 py-3 text-right text-amber-700">Sisa Qty</th>
                <th className="px-4 py-3">Satuan</th>
                <th className="px-4 py-3 text-right">Harga Satuan</th>
                <th className="px-4 py-3 text-right">Diskon</th>
                <th className="px-4 py-3 text-right">PPN</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.items?.map((it: any) => (
                <tr key={it.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">{it.item?.itemName}</div>
                    <div className="text-[10px] text-slate-400">{it.specification || it.item?.specification}</div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                    {it.quantity}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-emerald-700 bg-emerald-50/30">
                    {it.receivedQty}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-amber-700 bg-amber-50/30">
                    {it.remainingQty}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-600">
                    {it.unit?.code || it.unit?.name}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                    {formatCurrency(it.unitPrice)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600">
                    {it.discount ? `${it.discount}%` : '-'}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600">
                    {it.taxPercent ? `${it.taxPercent}%` : '-'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-slate-900">
                    {formatCurrency(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total Calculations */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col items-end text-xs space-y-1">
          <div className="flex justify-between w-64 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold">{formatCurrency(po.subtotal)}</span>
          </div>
          <div className="flex justify-between w-64 text-slate-600">
            <span>Diskon:</span>
            <span className="font-semibold text-emerald-700">-{formatCurrency(po.discount)}</span>
          </div>
          <div className="flex justify-between w-64 text-slate-600">
            <span>PPN:</span>
            <span className="font-semibold">{formatCurrency(po.taxAmount)}</span>
          </div>
          <div className="flex justify-between w-64 pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
            <span>Total Pembelian PO:</span>
            <span className="text-amber-700">{formatCurrency(po.totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

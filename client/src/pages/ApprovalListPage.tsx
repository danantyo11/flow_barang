import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { CheckCircle2, XCircle, RotateCcw, Clock, Shield, Sliders, ChevronRight } from 'lucide-react';

export const ApprovalListPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'matrix'>('pending');
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const [resPending, resFlows] = await Promise.all([
        api.get('/approvals/pending'),
        api.get('/approvals/flows'),
      ]);
      setPendingList(resPending.data.data || []);
      setFlows(resFlows.data.data || []);
    } catch (e) {
      console.error('Failed to load approvals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (instanceId: string, action: 'approve' | 'reject' | 'revision') => {
    const defaultComment =
      action === 'approve'
        ? 'Disetujui. Sesuai kebutuhan dan anggaran.'
        : action === 'reject'
        ? 'Ditolak.'
        : 'Mohon revisi penawaran atau kuantitas.';

    const comments = prompt(`Masukkan komentar / catatan persetujuan (${action}):`, defaultComment);
    if (comments === null) return;

    setActionLoading(true);
    try {
      await api.post(`/approvals/${instanceId}/${action}`, { comments });
      alert(`Tindakan ${action.toUpperCase()} berhasil diproses.`);
      await fetchPending();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memproses approval');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Persetujuan Dokumen (Approval Engine)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tinjau dan proses persetujuan Purchase Order berjenjang sesuai approval matrix
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Menunggu Persetujuan ({pendingList.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === 'matrix'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Matriks Persetujuan
          </button>
        </div>
      </div>

      {activeTab === 'pending' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Memuat data persetujuan...</div>
          ) : pendingList.length > 0 ? (
            pendingList.map((inst) => (
              <div
                key={inst.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        {inst.documentType}
                      </span>
                      <h3 className="text-base font-black text-slate-900">{inst.documentNumber}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Supplier: <strong>{inst.document?.supplier?.supplierName || '-'}</strong> • Divisi:{' '}
                      {inst.document?.purchaseRequest?.department?.departmentName || '-'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      Nilai Pengadaan
                    </span>
                    <span className="text-base sm:text-lg font-black text-purple-700">
                      {formatCurrency(inst.document?.totalAmount || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>
                      Tahap Persetujuan ke-<strong>{inst.currentStep}</strong> dari{' '}
                      <strong>{inst.totalSteps}</strong> tahap pimpinan
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                {inst.document?.items && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50">
                        <tr>
                          <th className="px-3 py-2">Barang</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2">Satuan</th>
                          <th className="px-3 py-2 text-right">Harga Satuan</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inst.document.items
                          .filter((it: any) => it.quantity > 0)
                          .map((it: any) => (
                            <tr key={it.id}>
                              <td className="px-3 py-2 font-medium text-slate-800">{it.item?.itemName}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">{it.quantity}</td>
                              <td className="px-3 py-2 text-slate-500">{it.unit?.code}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(it.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(it.subtotal)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Approval Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleAction(inst.id, 'revision')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-xs rounded-xl border border-orange-200 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Minta Revisi
                  </button>
                  <button
                    onClick={() => handleAction(inst.id, 'reject')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs rounded-xl border border-rose-200 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Tolak Dokumen
                  </button>
                  <button
                    onClick={() => handleAction(inst.id, 'approve')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Setujui (Approve)
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">Semua Persetujuan Selesai</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tidak ada dokumen PO yang sedang menunggu persetujuan Anda saat ini.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Configurable Approval Matrix View (Section 13) */
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  Approval Matrix (Konfigurasi Threshold Nilai PO)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Konfigurasi jenjang persetujuan fleksibel dan tidak hard-coded per Section 13.
                </p>
              </div>
              <span className="text-xs text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Konfigurasi Aktif
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {flows.map((flow) => (
                <div key={flow.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{flow.name}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Aktif
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="text-slate-500">Rentang Nilai:</div>
                    <div className="font-bold text-purple-900">
                      {formatCurrency(flow.minAmount)} s/d{' '}
                      {flow.maxAmount ? formatCurrency(flow.maxAmount) : 'Tak Terbatas'}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600">{flow.description}</p>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Urutan Approval:
                    </span>
                    <div className="space-y-1">
                      {flow.steps?.map((step: any) => (
                        <div key={step.id} className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                            {step.stepOrder}
                          </span>
                          <span>{step.requiredPosition || step.role?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

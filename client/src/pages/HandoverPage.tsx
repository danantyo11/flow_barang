import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { PackageCheck, CheckCircle2, Search, User, Building, Clock } from 'lucide-react';

export const HandoverPage: React.FC = () => {
  const { user } = useAuth();
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchHandovers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/handovers');
      setHandovers(res.data.data || []);
    } catch (e) {
      console.error('Failed to load handovers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandovers();
  }, []);

  const handleConfirmReceipt = async (hoId: string) => {
    const note = prompt(
      'Masukkan catatan konfirmasi serah terima barang:',
      `Diterima lengkap dan sesuai spesifikasi oleh ${user?.name} pada ${new Date().toLocaleDateString('id-ID')}`
    );
    if (!note) return;

    setActionLoading(true);
    try {
      await api.post(`/handovers/${hoId}/confirm`, {
        receiverSignatureNote: note,
      });
      alert('Konfirmasi serah terima berhasil! Alur pengadaan selesai (COMPLETED).');
      await fetchHandovers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal konfirmasi serah terima');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Serah Terima Barang (Handover)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokumen serah terima fisik barang kepada user/divisi pemohon dengan konfirmasi penerimaan
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data serah terima...</div>
        ) : handovers.length > 0 ? (
          handovers.map((ho) => (
            <div
              key={ho.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{ho.hoNumber}</h3>
                    <StatusBadge status={ho.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Tanggal: {new Date(ho.handoverDate).toLocaleDateString('id-ID')} • Ref PR:{' '}
                    <strong>{ho.purchaseRequest?.prNumber || '-'}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                    Divisi Penerima
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {ho.department?.departmentName}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Barang</th>
                      <th className="px-3 py-2 text-right">Jumlah Diserahkan</th>
                      <th className="px-3 py-2">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ho.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-bold text-slate-800">{it.item?.itemName}</td>
                        <td className="px-3 py-2 text-right font-extrabold text-slate-900">{it.quantity}</td>
                        <td className="px-3 py-2 text-slate-500">{it.unit?.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirmation Note if already completed */}
              {ho.receiverSignatureNote && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                  <span className="font-bold block">Tanda Terima / Konfirmasi Pemohon:</span>
                  <p className="mt-0.5">{ho.receiverSignatureNote}</p>
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                    Penerima: {ho.receiverName}
                  </span>
                </div>
              )}

              {/* Action Button for Requester */}
              {ho.status === 'WAITING_HANDOVER' && (
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleConfirmReceipt(ho.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Konfirmasi Penerimaan Fisik Barang
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada dokumen serah terima</p>
          </div>
        )}
      </div>
    </div>
  );
};

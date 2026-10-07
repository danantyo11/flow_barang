import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Warehouse, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, Sparkles } from 'lucide-react';

export const WarehouseCheckPage: React.FC = () => {
  const { prId } = useParams<{ prId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pendingPRs, setPendingPRs] = useState<any[]>([]);
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [itemsCheck, setItemsCheck] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingPRs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/purchase-requests?status=WAITING_WAREHOUSE_CHECK');
      const list = res.data.data || [];
      setPendingPRs(list);

      if (prId) {
        const found = list.find((p: any) => p.id === prId);
        if (found) selectPR(found);
        else {
          // fetch directly
          const directRes = await api.get(`/purchase-requests/${prId}`);
          selectPR(directRes.data.data);
        }
      } else if (list.length > 0) {
        selectPR(list[0]);
      }
    } catch (e) {
      console.error('Failed to load pending PRs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPRs();
  }, [prId]);

  const selectPR = (pr: any) => {
    setSelectedPR(pr);
    setError(null);
    const prepared = (pr.items || []).map((it: any) => {
      // Calculate current available stock across warehouses
      const currentStock = it.item?.stockBalances?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
      const requested = it.requestedQty;
      // Auto-allocate whatever is available up to requested quantity
      const allocated = Math.min(requested, currentStock);
      const purchase = Math.max(0, requested - allocated);

      return {
        prItemId: it.id,
        itemName: it.item?.itemName,
        itemCode: it.item?.itemCode,
        requestedQty: requested,
        unitCode: it.unit?.code || it.unit?.name,
        availableStock: currentStock,
        allocatedQty: allocated,
        purchaseQty: purchase,
        notes: '',
      };
    });
    setItemsCheck(prepared);
  };

  const handleQtyChange = (index: number, field: 'allocatedQty' | 'purchaseQty', value: number) => {
    const copy = [...itemsCheck];
    const row = copy[index];
    const requested = row.requestedQty;

    if (field === 'allocatedQty') {
      const allocated = Math.max(0, Math.min(value, requested));
      row.allocatedQty = allocated;
      row.purchaseQty = Math.max(0, requested - allocated);
    } else {
      const purchase = Math.max(0, Math.min(value, requested));
      row.purchaseQty = purchase;
      row.allocatedQty = Math.max(0, requested - purchase);
    }

    setItemsCheck(copy);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await api.post(`/purchase-requests/${selectedPR.id}/warehouse-check`, {
        items: itemsCheck.map((i) => ({
          prItemId: i.prItemId,
          availableStock: Number(i.availableStock),
          allocatedQty: Number(i.allocatedQty),
          purchaseQty: Number(i.purchaseQty),
          notes: i.notes || null,
        })),
        notes,
      });

      alert('Hasil pemeriksaan stok gudang berhasil disimpan!');
      navigate('/purchase-requests');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menyimpan pemeriksaan gudang');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Cek Stok Gudang (Warehouse Stock Checking)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Periksa ketersediaan barang di gudang. Pisahkan jumlah yang dapat dipenuhi dari stok dengan jumlah yang harus dibeli (Purchasing).
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left List of Pending PRs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm lg:col-span-1 h-fit">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Menunggu Pemeriksaan ({pendingPRs.length})
          </h2>
          {pendingPRs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pendingPRs.map((pr) => (
                <div
                  key={pr.id}
                  onClick={() => selectPR(pr)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                    selectedPR?.id === pr.id
                      ? 'bg-amber-50 border-amber-300 font-bold'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-amber-800">{pr.prNumber}</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                      {pr.priority}
                    </span>
                  </div>
                  <div className="text-slate-600 font-medium mt-1 truncate">{pr.requester?.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{pr.items?.length || 0} barang</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              Tidak ada PR yang menunggu pemeriksaan gudang saat ini.
            </div>
          )}
        </div>

        {/* Right Active Inspection Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-3 space-y-6">
          {selectedPR ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Dokumen yang sedang diperiksa
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">
                    {selectedPR.prNumber} — {selectedPR.department?.departmentName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pemohon: <strong>{selectedPR.requester?.name}</strong> • Keperluan: {selectedPR.purpose || '-'}
                  </p>
                </div>
                <StatusBadge status={selectedPR.status} />
              </div>

              {/* Business Rule Reminder Banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>
                  <strong>Aturan Sistem (Section 9):</strong> Alokasi kuantitas stok gudang + kuantitas pembelian eksternal harus sama dengan kuantitas yang diminta pemohon.
                </span>
              </div>

              {/* Items Allocation Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Barang</th>
                      <th className="px-3 py-2.5 text-right w-24">Diminta</th>
                      <th className="px-3 py-2.5 text-right text-blue-700 w-24">Stok Ada</th>
                      <th className="px-3 py-2.5 text-right text-emerald-700 w-32">Alokasi Gudang</th>
                      <th className="px-3 py-2.5 text-right text-purple-700 w-32">Beli (Purchasing)</th>
                      <th className="px-3 py-2.5">Catatan Gudang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsCheck.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">{row.itemName}</div>
                          <div className="text-[10px] text-slate-400">{row.itemCode}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-slate-900">
                          {row.requestedQty} {row.unitCode}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-blue-700">
                          {row.availableStock}
                        </td>
                        <td className="px-3 py-3 text-right bg-emerald-50/40">
                          <input
                            type="number"
                            min="0"
                            max={row.requestedQty}
                            value={row.allocatedQty}
                            onChange={(e) => handleQtyChange(idx, 'allocatedQty', Number(e.target.value))}
                            className="w-24 text-right border border-emerald-300 rounded px-2 py-1 font-bold text-emerald-800 outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-right bg-purple-50/40">
                          <input
                            type="number"
                            min="0"
                            max={row.requestedQty}
                            value={row.purchaseQty}
                            onChange={(e) => handleQtyChange(idx, 'purchaseQty', Number(e.target.value))}
                            className="w-24 text-right border border-purple-300 rounded px-2 py-1 font-bold text-purple-800 outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="Lokasi rak / kondisi..."
                            value={row.notes}
                            onChange={(e) => {
                              const copy = [...itemsCheck];
                              copy[idx].notes = e.target.value;
                              setItemsCheck(copy);
                            }}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Keseluruhan Gudang
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan hasil inspeksi ketersediaan fisik stok gudang..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/purchase-requests')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Menyimpan...' : 'Konfirmasi Hasil Cek Stok'}
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Pilih salah satu PR dari daftar di sebelah kiri untuk memulai pemeriksaan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

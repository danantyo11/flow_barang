import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { PackageMinus, Plus, Search, Calendar, User, Building, Boxes } from 'lucide-react';

export const GoodsIssuePage: React.FC = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [prList, setPrList] = useState<any[]>([]);
  const [itemsMaster, setItemsMaster] = useState<any[]>([]);

  const [selectedWhId, setSelectedWhId] = useState('');
  const [selectedPrId, setSelectedPrId] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterId, setRequesterId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const [resGi, resWh, resPr, resItems] = await Promise.all([
        api.get('/goods-issues'),
        api.get('/warehouses'),
        api.get('/purchase-requests'),
        api.get('/items'),
      ]);
      setIssues(resGi.data.data || []);
      setWarehouses(resWh.data.data || []);
      setPrList(resPr.data.data || []);
      setItemsMaster(resItems.data.data || []);
    } catch (e) {
      console.error('Failed to load GI data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleOpenModal = () => {
    if (warehouses.length > 0) setSelectedWhId(warehouses[0].id);
    if (itemsMaster.length > 0) {
      setItems([
        {
          itemId: itemsMaster[0].id,
          itemName: itemsMaster[0].itemName,
          quantity: 1,
          unitId: itemsMaster[0].unitId,
          unitCode: itemsMaster[0].unitCode || itemsMaster[0].unit,
        },
      ]);
    }
    setShowCreateModal(true);
  };

  const handleSelectPR = (prId: string) => {
    setSelectedPrId(prId);
    const found = prList.find((p) => p.id === prId);
    if (found) {
      setRequesterId(found.requesterId);
      setRequesterName(found.requester?.name || '');
      setDepartmentId(found.departmentId);

      // Preload PR items
      const prefilled = found.items.map((it: any) => ({
        itemId: it.itemId,
        itemName: it.item?.itemName,
        quantity: it.allocatedQty || it.requestedQty,
        unitId: it.unitId,
        unitCode: it.unit?.code || it.unit?.name,
      }));
      setItems(prefilled);
    }
  };

  const handleSubmitGI = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/goods-issues', {
        prId: selectedPrId || null,
        requesterId: requesterId || user?.id,
        departmentId: departmentId || user?.departmentId,
        warehouseId: selectedWhId,
        notes,
        items: items.map((i) => ({
          itemId: i.itemId,
          quantity: Number(i.quantity),
          unitId: i.unitId,
        })),
      });

      alert('Pengeluaran barang dari stok gudang berhasil dicatat!');
      setShowCreateModal(false);
      await fetchIssues();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memproses pengeluaran barang');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pengeluaran Barang Gudang (Goods Issue / GI)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokumen resmi mutasi pengurangan stok gudang untuk kebutuhan divisi operasional
          </p>
        </div>

        {['ADMIN', 'WAREHOUSE'].includes(user?.roleName || '') && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            + Buat Pengeluaran Barang
          </button>
        )}
      </div>

      {/* GI Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data pengeluaran barang...</div>
        ) : issues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">No GI</th>
                  <th className="px-4 py-3">Tanggal Pengeluaran</th>
                  <th className="px-4 py-3">Gudang Asal</th>
                  <th className="px-4 py-3">Penerima & Divisi</th>
                  <th className="px-4 py-3">Ref. PR</th>
                  <th className="px-4 py-3">Jumlah Item</th>
                  <th className="px-4 py-3">Petugas Gudang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((gi) => (
                  <tr key={gi.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 font-bold text-amber-800">{gi.giNumber}</td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(gi.issueDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {gi.warehouse?.warehouseName}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{gi.requester?.name}</div>
                      <div className="text-[10px] text-slate-400">{gi.department?.departmentName}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{gi.purchaseRequest?.prNumber || '-'}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{gi.items?.length || 0} barang</td>
                    <td className="px-4 py-3.5 text-slate-600">{gi.createdBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <PackageMinus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada dokumen pengeluaran barang</p>
          </div>
        )}
      </div>

      {/* Modal Create GI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-black text-slate-900">
              Buat Dokumen Pengeluaran Barang (GI)
            </h2>

            <form onSubmit={handleSubmitGI} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Gudang Asal *</label>
                  <select
                    required
                    value={selectedWhId}
                    onChange={(e) => setSelectedWhId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouseName} ({w.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Referensi PR (Opsional)</label>
                  <select
                    value={selectedPrId}
                    onChange={(e) => handleSelectPR(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  >
                    <option value="">Tanpa PR</option>
                    {prList.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.prNumber} - {pr.department?.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <h4 className="font-bold text-slate-800">Daftar Barang yang Dikeluarkan</h4>
                {items.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex-1 font-bold text-slate-900">{row.itemName}</div>
                    <div className="w-24">
                      <label className="text-[10px] text-slate-500 block">Kuantitas</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].quantity = Number(e.target.value);
                          setItems(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-right font-bold"
                      />
                    </div>
                    <span className="font-semibold text-slate-600">{row.unitCode}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow"
                >
                  {submitting ? 'Memproses...' : 'Keluarkan dari Stok Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

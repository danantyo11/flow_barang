import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Boxes, Search, AlertTriangle, ScrollText, SlidersHorizontal, Plus } from 'lucide-react';

export const StockBalancesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Adjustment state
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustWhId, setAdjustWhId] = useState('');
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchStock = async () => {
    setLoading(true);
    try {
      let query = statusFilter ? `?status=${statusFilter}` : '';
      const [resStock, resWhs] = await Promise.all([
        api.get(`/stock/balances${query}`),
        api.get('/warehouses'),
      ]);
      setBalances(resStock.data.data || []);
      setWarehouses(resWhs.data.data || []);
    } catch (e) {
      console.error('Failed to load stock balances', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [statusFilter]);

  const handleOpenAdjust = (itemId?: string) => {
    if (itemId) setAdjustItemId(itemId);
    else if (balances.length > 0) setAdjustItemId(balances[0].item.id);

    if (warehouses.length > 0) setAdjustWhId(warehouses[0].id);
    setAdjustNotes('');
    setAdjustQty(1);
    setShowAdjustModal(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/stock/adjust', {
        itemId: adjustItemId,
        warehouseId: adjustWhId,
        type: adjustType,
        quantity: Number(adjustQty),
        notes: adjustNotes,
      });
      alert('Penyesuaian stok berhasil disimpan');
      setShowAdjustModal(false);
      await fetchStock();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan penyesuaian stok');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = balances.filter((b) => {
    const q = searchTerm.toLowerCase();
    return (
      b.item.itemName.toLowerCase().includes(q) ||
      b.item.itemCode.toLowerCase().includes(q) ||
      b.item.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Stok Gudang (Inventory Balances)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring posisi persediaan barang real-time, level minimum, reorder point, dan stok kritis
          </p>
        </div>

        {['ADMIN', 'WAREHOUSE'].includes(user?.roleName || '') && (
          <button
            onClick={() => handleOpenAdjust()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            + Penyesuaian Stok (Adjustment)
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari kode barang, nama, kategori..."
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
          <option value="">Semua Status Stok</option>
          <option value="CRITICAL">CRITICAL (Stok Kritis / Kowi)</option>
          <option value="LOW_STOCK">LOW STOCK (Mendekati Minimum)</option>
          <option value="NORMAL">NORMAL (Aman)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data stok...</div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Kode & Nama Barang</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Min Stok</th>
                  <th className="px-4 py-3 text-right">Reorder Point</th>
                  <th className="px-4 py-3 text-right">Critical Level</th>
                  <th className="px-4 py-3 text-right text-base font-black text-slate-900">Total Stok</th>
                  <th className="px-4 py-3">Satuan</th>
                  <th className="px-4 py-3">Status Level</th>
                  <th className="px-4 py-3 text-right">Kartu Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {row.item.itemName}
                        {row.item.isCritical && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                            KRITIS
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{row.item.itemCode}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">{row.item.category}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{row.item.minimumStock}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{row.item.reorderPoint}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-rose-700">{row.item.criticalStock}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-black text-slate-900">
                      {row.totalQuantity}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-600">{row.item.unit}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={row.stockStatus} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => navigate(`/stock-card?itemId=${row.item.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition"
                      >
                        <ScrollText className="w-3.5 h-3.5" />
                        Kartu Stok
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Tidak ada data stok ditemukan</p>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-black text-slate-900">
              Penyesuaian Stok Barang (Stock Adjustment)
            </h2>

            <form onSubmit={handleSaveAdjust} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Barang</label>
                <select
                  value={adjustItemId}
                  onChange={(e) => setAdjustItemId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                >
                  {balances.map((b) => (
                    <option key={b.item.id} value={b.item.id}>
                      {b.item.itemCode} - {b.item.itemName} (Stok: {b.totalQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gudang</label>
                  <select
                    value={adjustWhId}
                    onChange={(e) => setAdjustWhId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Penyesuaian</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none font-bold"
                  >
                    <option value="ADJUSTMENT_IN">ADJUSTMENT IN (+ Tambah)</option>
                    <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT (- Kurangi)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Kuantitas</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold text-sm outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Penyesuaian *</label>
                <textarea
                  rows={2}
                  required
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Contoh: Selisih stok opname fisik bulanan..."
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

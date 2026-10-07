import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { CreditCard, Plus, Calendar, DollarSign, Store, FileText } from 'lucide-react';

export const DirectPurchasePage: React.FC = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [storeName, setStoreName] = useState('');
  const [invoiceReceipt, setInvoiceReceipt] = useState('');
  const [purchaserName, setPurchaserName] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [itemsMaster, setItemsMaster] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const [resDp, resItems] = await Promise.all([
        api.get('/direct-purchases'),
        api.get('/items'),
      ]);
      setPurchases(resDp.data.data || []);
      setItemsMaster(resItems.data.data || []);
    } catch (e) {
      console.error('Failed to load direct purchases', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handleOpenModal = () => {
    if (itemsMaster.length > 0) {
      setItems([
        {
          itemId: itemsMaster[0].id,
          itemName: itemsMaster[0].itemName,
          quantity: 1,
          unitId: itemsMaster[0].unitId,
          unitPrice: 0,
        },
      ]);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/direct-purchases', {
        storeName,
        invoiceReceiptNumber: invoiceReceipt,
        purchaserName,
        notes,
        items: items.map((i) => ({
          itemId: i.itemId,
          quantity: Number(i.quantity),
          unitId: i.unitId,
          unitPrice: Number(i.unitPrice),
        })),
      });

      alert('Pembelian langsung berhasil dicatat');
      setShowModal(false);
      await fetchPurchases();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan pembelian langsung');
    } finally {
      setSubmitting(false);
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
            Pembelian Langsung (Direct Purchase)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan pembelian barang langsung dari toko/pasar dengan bukti kuitansi atau nota tunai
          </p>
        </div>

        {['ADMIN', 'PURCHASING'].includes(user?.roleName || '') && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            + Catat Pembelian Langsung
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data pembelian langsung...</div>
        ) : purchases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">No Bukti DP</th>
                  <th className="px-4 py-3">Tanggal Beli</th>
                  <th className="px-4 py-3">Toko / Supplier</th>
                  <th className="px-4 py-3">No Nota / Kuitansi</th>
                  <th className="px-4 py-3">Pembeli</th>
                  <th className="px-4 py-3 text-right">Total Nilai</th>
                  <th className="px-4 py-3">Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((dp) => (
                  <tr key={dp.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 font-bold text-amber-800">{dp.dpNumber}</td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(dp.purchaseDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{dp.storeName}</td>
                    <td className="px-4 py-3.5 text-slate-600">{dp.invoiceReceiptNumber || '-'}</td>
                    <td className="px-4 py-3.5 text-slate-700">{dp.purchaserName}</td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">
                      {formatCurrency(dp.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{dp.items?.length || 0} barang</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada transaksi pembelian langsung</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <h2 className="text-base font-black text-slate-900">
              Formulir Pembelian Langsung (Direct Purchase)
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Toko / Penjual *</label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Toko Baut Perkasa / Mitra Teknik"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Nota / Kwitansi</label>
                  <input
                    type="text"
                    value={invoiceReceipt}
                    onChange={(e) => setInvoiceReceipt(e.target.value)}
                    placeholder="NOTA-9981"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Pembeli *</label>
                <input
                  type="text"
                  required
                  value={purchaserName}
                  onChange={(e) => setPurchaserName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                />
              </div>

              {/* Items */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <h4 className="font-bold text-slate-800">Barang yang Dibeli</h4>
                {items.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex-1">
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const copy = [...items];
                          const sel = itemsMaster.find((m) => m.id === e.target.value);
                          if (sel) {
                            copy[idx].itemId = sel.id;
                            copy[idx].itemName = sel.itemName;
                            copy[idx].unitId = sel.unitId;
                          }
                          setItems(copy);
                        }}
                        className="w-full border border-slate-300 rounded p-1 outline-none text-xs"
                      >
                        {itemsMaster.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.itemName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
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
                        placeholder="Qty"
                        className="w-full border border-slate-300 rounded p-1 text-right font-bold"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        value={row.unitPrice}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].unitPrice = Number(e.target.value);
                          setItems(copy);
                        }}
                        placeholder="Harga (Rp)"
                        className="w-full border border-slate-300 rounded p-1 text-right font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pembelian Langsung'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

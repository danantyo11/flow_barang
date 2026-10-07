import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { ScrollText, ArrowDownLeft, ArrowUpRight, Search, Printer, Calendar } from 'lucide-react';

export const StockCardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(searchParams.get('itemId') || '');
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get('/items');
        const list = res.data.data || [];
        setItems(list);

        const initId = searchParams.get('itemId');
        if (initId) setSelectedItemId(initId);
        else if (list.length > 0) setSelectedItemId(list[0].id);
      } catch (e) {
        console.error('Failed to load items for stock card', e);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;

    const fetchCard = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/stock/card/${selectedItemId}`);
        setCardData(res.data.data);
      } catch (e) {
        console.error('Failed to load stock card', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [selectedItemId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Kartu Stok Barang (Stock Card Ledger)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Buku besar mutasi persediaan barang secara kronologis dan saldo berjalan (running balance)
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 shadow-sm transition"
        >
          <Printer className="w-4 h-4" />
          Cetak Kartu Stok
        </button>
      </div>

      {/* Item Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Barang</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
          >
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.itemCode} - {it.itemName} ({it.category})
              </option>
            ))}
          </select>
        </div>

        {cardData?.item && (
          <div className="flex items-center gap-6 text-xs text-right">
            <div>
              <span className="text-slate-400 font-medium block">Satuan</span>
              <span className="font-bold text-slate-800">{cardData.item.unit?.name}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Saldo Stok Saat Ini</span>
              <span className="text-xl font-black text-amber-700">{cardData.currentStock}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stock Card Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat mutasi kartu stok...</div>
        ) : cardData?.ledger && cardData.ledger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Tanggal & Waktu</th>
                  <th className="px-4 py-3">No Transaksi</th>
                  <th className="px-4 py-3">Tipe Mutasi</th>
                  <th className="px-4 py-3">Referensi</th>
                  <th className="px-4 py-3">Gudang & Lokasi</th>
                  <th className="px-4 py-3 text-right text-emerald-700">Masuk (+)</th>
                  <th className="px-4 py-3 text-right text-rose-700">Keluar (-)</th>
                  <th className="px-4 py-3 text-right font-black text-slate-900">Saldo Akhir</th>
                  <th className="px-4 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cardData.ledger.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(entry.date).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700 font-medium">
                      {entry.transactionNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-amber-800">
                      {entry.referenceId}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {entry.warehouse} • {entry.location}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
                      {entry.qtyIn > 0 ? `+${entry.qtyIn}` : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-rose-700">
                      {entry.qtyOut > 0 ? `-${entry.qtyOut}` : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-black text-slate-900 bg-slate-50/60">
                      {entry.balanceAfter}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">
                      {entry.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada riwayat transaksi mutasi untuk barang ini</p>
          </div>
        )}
      </div>
    </div>
  );
};

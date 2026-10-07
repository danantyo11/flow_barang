import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Plus,
  Search,
  ShoppingCart,
  ChevronRight,
  FileText,
  Boxes,
  CheckSquare,
  Building,
  User,
  Clock,
  Trash2,
  AlertCircle
} from 'lucide-react';

export const POListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'POS' | 'PENDING_PR_ITEMS'>('POS');
  const [pos, setPos] = useState<any[]>([]);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = statusFilter ? `?status=${statusFilter}` : '';
      const [resPos, resPending] = await Promise.all([
        api.get(`/purchase-orders${query}`),
        api.get('/purchase-orders/pending-items'),
      ]);
      setPos(resPos.data.data || []);
      setPendingItems(resPending.data.data || []);
    } catch (e) {
      console.error('Failed to load POs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleDeletePO = async (po: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Hapus/Batalkan PO ${po.poNumber}? Seluruh item barang akan otomatis dikembalikan ke antrean siap PO.`)) {
      return;
    }

    try {
      await api.delete(`/purchase-orders/${po.id}`);
      alert(`PO ${po.poNumber} berhasil dihapus. Item barang telah dikembalikan ke daftar siap PO.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus PO');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  const filteredPOs = pos.filter((po) => {
    const q = searchTerm.toLowerCase();
    return (
      po.poNumber?.toLowerCase().includes(q) ||
      po.supplier?.supplierName?.toLowerCase().includes(q) ||
      po.purchaseRequest?.prNumber?.toLowerCase().includes(q)
    );
  });

  const filteredPendingItems = pendingItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.prNumber?.toLowerCase().includes(q) ||
      item.itemName?.toLowerCase().includes(q) ||
      item.itemCode?.toLowerCase().includes(q) ||
      item.departmentName?.toLowerCase().includes(q) ||
      item.suggestedSupplierName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Purchase Order (PO) & Antrean Item PR
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih dan checklist item-item dari seluruh PR masuk untuk digabung ke dalam satu PO vendor
          </p>
        </div>

        {['ADMIN', 'PURCHASING'].includes(user?.roleName || '') && (
          <button
            onClick={() => navigate('/purchase-orders/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            + Buat PO Baru (Pilih Item PR)
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('POS')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 relative ${
            activeTab === 'POS'
              ? 'text-amber-700 border-b-2 border-amber-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Daftar Purchase Order
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-700 font-mono">
            {pos.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PENDING_PR_ITEMS')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 relative ${
            activeTab === 'PENDING_PR_ITEMS'
              ? 'text-amber-700 border-b-2 border-amber-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-indigo-600" />
          Antrean Item PR Belum PO (Siap Digabung)
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold">
            {pendingItems.length}
          </span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              activeTab === 'POS'
                ? 'Cari nomor PO, supplier, PR...'
                : 'Cari nomor PR, nama barang, kode...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {activeTab === 'POS' ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none w-full md:w-auto"
          >
            <option value="">Semua Status PO</option>
            <option value="DRAFT">DRAFT</option>
            <option value="WAITING_APPROVAL">WAITING APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SENT">SENT (Terkirim ke Vendor)</option>
            <option value="PARTIALLY_RECEIVED">PARTIALLY RECEIVED</option>
            <option value="FULLY_RECEIVED">FULLY RECEIVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        ) : (
          <span className="text-xs text-slate-500 font-medium">
            💡 <strong>Item otomatis hilang dari antrean</strong> setelah dibuatkan PO, dan akan muncul kembali jika PO dihapus.
          </span>
        )}
      </div>

      {/* TAB 1: DAFTAR PO */}
      {activeTab === 'POS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Memuat data Purchase Order...</div>
          ) : filteredPOs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">No PO</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Supplier / Vendor</th>
                    <th className="px-4 py-3">Ref. PR</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Total Nilai</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPOs.map((po) => (
                    <tr
                      key={po.id}
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3.5 font-bold text-amber-700">
                        {po.poNumber}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {new Date(po.poDate).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {po.supplier?.supplierName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono">
                        {po.purchaseRequest?.prNumber || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {po.items?.length || 0} item
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {['DRAFT', 'REJECTED', 'REVISION_REQUIRED'].includes(po.status) && (
                            <button
                              type="button"
                              onClick={(e) => handleDeletePO(po, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus PO (Kembalikan Item ke Antrean)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Belum ada Purchase Order</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANTREAN ITEM DARI SELURUH PR (BELUM DIBUATKAN PO) */}
      {activeTab === 'PENDING_PR_ITEMS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-600" />
                Daftar Seluruh Barang Dari PR yang Belum Diterbitkan PO
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Item-item di bawah ini siap dipilih dan digabungkan ke dalam satu PO sesuai vendor yang Anda tuju.
              </p>
            </div>

            <button
              onClick={() => navigate('/purchase-orders/new')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <CheckSquare className="w-4 h-4" />
              Buka Form PO & Checklist Item
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Memuat antrean item PR...
            </div>
          ) : filteredPendingItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">No PR Asal</th>
                    <th className="px-4 py-3">Pemohon & Divisi</th>
                    <th className="px-4 py-3">Barang & Kode</th>
                    <th className="px-4 py-3">Spesifikasi</th>
                    <th className="px-4 py-3 text-right">Qty Perlu Beli</th>
                    <th className="px-4 py-3">Satuan</th>
                    <th className="px-4 py-3">Vendor Disarankan</th>
                    <th className="px-4 py-3 text-right">Harga Satuan Est.</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5 font-bold font-mono text-indigo-700">
                        {item.prNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{item.requesterName}</div>
                        <div className="text-[10px] text-slate-400">{item.departmentName}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{item.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.itemCode}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">
                        {item.specification || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-purple-700 text-sm">
                        {item.purchaseQty}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-600">
                        {item.unitCode}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.suggestedSupplierName ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {item.suggestedSupplierName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                        {formatCurrency(item.suggestedPrice || item.estimatedPrice || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() =>
                            navigate(
                              `/purchase-orders/new?prId=${item.prId}${
                                item.suggestedSupplierId ? `&supplierId=${item.suggestedSupplierId}` : ''
                              }`
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-xs transition border border-amber-200"
                        >
                          + Masukkan ke PO
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
              <p className="text-xs font-semibold text-slate-700">
                Semua item PR telah diterbitkan PO atau dipenuhi stok gudang.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

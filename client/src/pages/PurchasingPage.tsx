import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import {
  ShoppingBag,
  Plus,
  CheckCircle2,
  FileText,
  Clock,
  Truck,
  DollarSign,
  ArrowRight,
  TrendingDown,
  Sparkles
} from 'lucide-react';

export const PurchasingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [procurementPRs, setProcurementPRs] = useState<any[]>([]);
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddQuotModal, setShowAddQuotModal] = useState(false);

  // New quotation modal form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [quotNumber, setQuotNumber] = useState('');
  const [leadTime, setLeadTime] = useState(3);
  const [paymentTerms, setPaymentTerms] = useState('NET 30');
  const [shippingCost, setShippingCost] = useState(0);
  const [quotItems, setQuotItems] = useState<any[]>([]);

  const fetchPRs = async () => {
    setLoading(true);
    try {
      const [resPRs, resSuppliers] = await Promise.all([
        api.get('/purchase-requests'),
        api.get('/suppliers'),
      ]);

      const allPRs = resPRs.data.data || [];
      // Filter PRs that have purchasing need
      const filtered = allPRs.filter((p: any) =>
        ['WAITING_PRICE', 'PROCUREMENT', 'PARTIAL_STOCK', 'WAITING_PO'].includes(p.status)
      );

      setProcurementPRs(filtered);
      setSuppliers(resSuppliers.data.data || []);

      const paramPrId = searchParams.get('prId');
      if (paramPrId) {
        const found = allPRs.find((p: any) => p.id === paramPrId);
        if (found) selectPR(found);
      } else if (filtered.length > 0) {
        selectPR(filtered[0]);
      }
    } catch (e) {
      console.error('Failed to load purchasing data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, []);

  const selectPR = async (pr: any) => {
    setSelectedPR(pr);
    try {
      const res = await api.get(`/suppliers/quotations/${pr.id}`);
      setQuotations(res.data.data || []);
    } catch (e) {
      console.error('Failed to load quotations', e);
    }
  };

  const handleSelectVendor = async (quotId: string) => {
    const reason = prompt('Masukkan alasan pemilihan vendor ini:', 'Harga terbaik dan lead time sesuai kebutuhan operasional');
    if (!reason) return;

    try {
      await api.post(`/suppliers/quotations/${quotId}/select`, { selectionReason: reason });
      await selectPR(selectedPR);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal memilih vendor');
    }
  };

  const openAddQuotModal = () => {
    if (!selectedPR || !suppliers.length) return;
    setSelectedSupplierId(suppliers[0].id);
    setQuotNumber(`QUOT-${Date.now().toString().slice(-6)}`);
    setQuotItems(
      selectedPR.items
        .filter((it: any) => it.purchaseQty > 0 || it.requestedQty > 0)
        .map((it: any) => ({
          prItemId: it.id,
          itemId: it.itemId,
          itemName: it.item?.itemName,
          purchaseQty: it.purchaseQty || it.requestedQty,
          unitPrice: it.estimatedPrice || 0,
          discount: 0,
          taxPercent: 0,
        }))
    );
    setShowAddQuotModal(true);
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/suppliers/quotations', {
        prId: selectedPR.id,
        supplierId: selectedSupplierId,
        quotationNumber: quotNumber,
        leadTimeDays: Number(leadTime),
        paymentTerms,
        shippingCost: Number(shippingCost),
        items: quotItems.map((qi) => ({
          prItemId: qi.prItemId,
          itemId: qi.itemId,
          unitPrice: Number(qi.unitPrice),
          discount: Number(qi.discount || 0),
          taxPercent: Number(qi.taxPercent || 0),
          leadTimeDays: Number(leadTime),
        })),
      });

      setShowAddQuotModal(false);
      await selectPR(selectedPR);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan quotation');
    }
  };

  const handleCreatePOFromQuotation = (quot: any) => {
    navigate(`/purchase-orders/new?prId=${selectedPR.id}&quotationId=${quot.id}&supplierId=${quot.supplierId}`);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Purchasing & Cek Harga (Quotation Comparison)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola penawaran harga vendor, komparasi terms, dan terbitkan Purchase Order
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left PR List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm lg:col-span-1 h-fit">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Permintaan Perlu Beli ({procurementPRs.length})
          </h2>
          {procurementPRs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {procurementPRs.map((pr) => (
                <div
                  key={pr.id}
                  onClick={() => selectPR(pr)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                    selectedPR?.id === pr.id
                      ? 'bg-purple-50 border-purple-300 font-bold'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-purple-900">{pr.prNumber}</span>
                    <StatusBadge status={pr.status} />
                  </div>
                  <div className="text-slate-700 font-semibold mt-1">{pr.department?.departmentName}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{pr.items?.length || 0} barang</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              Tidak ada PR yang menunggu sourcing saat ini.
            </div>
          )}
        </div>

        {/* Right Comparison Container */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-3 space-y-6">
          {selectedPR ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Penawaran Vendor untuk {selectedPR.prNumber}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pemohon: {selectedPR.requester?.name} • Divisi: {selectedPR.department?.departmentName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddQuotModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  + Masukkan Penawaran Vendor
                </button>
              </div>

              {/* Items to Purchase Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Daftar Barang yang Perlu Dibeli:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedPR.items?.map((it: any) => (
                    <div key={it.id} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900">{it.item?.itemName}</div>
                      <div className="text-[11px] text-purple-700 font-bold mt-0.5">
                        Qty Beli: {it.purchaseQty || it.requestedQty} {it.unit?.code}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quotation Comparison Cards (Section 11) */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Perbandingan Penawaran ({quotations.length} Vendor)
                </h3>

                {quotations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quotations.map((q) => (
                      <div
                        key={q.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
                          q.isSelected
                            ? 'bg-amber-50/50 border-amber-400 ring-2 ring-amber-400 shadow-md'
                            : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {q.quotationNumber}
                              </span>
                              <h4 className="text-sm font-black text-slate-900 mt-0.5">
                                {q.supplier?.supplierName}
                              </h4>
                            </div>
                            {q.isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                                <Sparkles className="w-3 h-3" /> Pilihan
                              </span>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Lead Time:</span>
                              <span className="font-bold text-slate-800">{q.leadTimeDays} Hari</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Payment Term:</span>
                              <span className="font-semibold text-slate-800">{q.paymentTerms || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ongkir:</span>
                              <span className="font-semibold text-slate-800">{formatCurrency(q.shippingCost)}</span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                              <span className="text-xs font-bold text-slate-700">Total Nilai:</span>
                              <span className="text-base font-black text-purple-700">
                                {formatCurrency(q.totalAmount)}
                              </span>
                            </div>

                            {q.selectionReason && (
                              <div className="p-2 bg-amber-100/50 rounded-lg text-[11px] text-amber-900 mt-2">
                                <strong>Alasan:</strong> {q.selectionReason}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-100 space-y-2">
                          {!q.isSelected ? (
                            <button
                              type="button"
                              onClick={() => handleSelectVendor(q.id)}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                            >
                              Pilih Vendor Ini
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCreatePOFromQuotation(q)}
                              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                            >
                              <FileText className="w-4 h-4" />
                              Terbitkan Purchase Order (PO)
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-400">Belum ada penawaran vendor yang dicatat untuk PR ini.</p>
                    <button
                      type="button"
                      onClick={openAddQuotModal}
                      className="mt-2 text-xs font-bold text-purple-700 hover:underline"
                    >
                      + Tambah penawaran vendor pertama
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Pilih PR di sebelah kiri untuk melihat komparasi penawaran harga.
            </div>
          )}
        </div>
      </div>

      {/* Modal Add Quotation */}
      {showAddQuotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-black text-slate-900">
              Tambah Penawaran Vendor (Supplier Quotation)
            </h2>

            <form onSubmit={handleSaveQuotation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Supplier</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierName} ({s.supplierCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Quotation</label>
                  <input
                    type="text"
                    required
                    value={quotNumber}
                    onChange={(e) => setQuotNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Hari)</label>
                  <input
                    type="number"
                    min="1"
                    value={leadTime}
                    onChange={(e) => setLeadTime(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Terms Pembayaran</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="NET 30 / COD / DP 50%"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none"
                  />
                </div>
              </div>

              {/* Quotation items price input */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <h4 className="font-bold text-slate-800">Harga Satuan Barang</h4>
                {quotItems.map((qi, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex-1">
                      <span className="font-bold text-slate-900 block">{qi.itemName}</span>
                      <span className="text-[10px] text-slate-500">Qty Beli: {qi.purchaseQty}</span>
                    </div>
                    <div className="w-36">
                      <label className="text-[10px] text-slate-500 block">Harga Satuan (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={qi.unitPrice}
                        onChange={(e) => {
                          const copy = [...quotItems];
                          copy[idx].unitPrice = Number(e.target.value);
                          setQuotItems(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-right font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddQuotModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow"
                >
                  Simpan Penawaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

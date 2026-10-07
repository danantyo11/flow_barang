import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { ArrowLeft, Save, ShoppingCart, Plus, Trash2, AlertCircle } from 'lucide-react';

export const POCreatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [prList, setPrList] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [itemsMaster, setItemsMaster] = useState<any[]>([]);

  const [selectedPrId, setSelectedPrId] = useState(searchParams.get('prId') || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState(searchParams.get('supplierId') || '');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('NET 30');
  const [shippingTerms, setShippingTerms] = useState('Franco Gudang Pabrik');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [resPr, resSup, resItems] = await Promise.all([
          api.get('/purchase-requests'),
          api.get('/suppliers'),
          api.get('/items'),
        ]);

        setPrList(resPr.data.data || []);
        setSuppliers(resSup.data.data || []);
        setItemsMaster(resItems.data.data || []);

        // Preload items if PR selected
        const prId = searchParams.get('prId');
        if (prId) {
          const pr = resPr.data.data.find((p: any) => p.id === prId);
          if (pr) {
            const prefilled = pr.items
              .filter((it: any) => (it.purchaseQty || it.requestedQty) > 0)
              .map((it: any) => ({
                prItemId: it.id,
                itemId: it.itemId,
                itemName: it.item?.itemName,
                specification: it.specification || it.item?.specification || '',
                quantity: it.purchaseQty || it.requestedQty,
                unitId: it.unitId,
                unitCode: it.unit?.code || it.unit?.name,
                unitPrice: it.estimatedPrice || 0,
                discount: 0,
                taxPercent: 0,
              }));
            setItems(prefilled);
          }
        }
      } catch (e) {
        console.error('Failed to load PO creation dependencies', e);
      }
    };
    loadData();
  }, []);

  const addItemRow = () => {
    if (itemsMaster.length === 0) return;
    const def = itemsMaster[0];
    setItems([
      ...items,
      {
        prItemId: null,
        itemId: def.id,
        itemName: def.itemName,
        specification: def.specification || '',
        quantity: 1,
        unitId: def.unitId,
        unitCode: def.unitCode || def.unit,
        unitPrice: 0,
        discount: 0,
        taxPercent: 0,
      },
    ]);
  };

  const updateItemRow = (index: number, field: string, val: any) => {
    const copy = [...items];
    if (field === 'itemId') {
      const selected = itemsMaster.find((it) => it.id === val);
      if (selected) {
        copy[index].itemId = selected.id;
        copy[index].itemName = selected.itemName;
        copy[index].unitId = selected.unitId;
        copy[index].unitCode = selected.unitCode || selected.unit;
      }
    } else {
      copy[index][field] = val;
    }
    setItems(copy);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Preview calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    items.forEach((it) => {
      const gross = it.quantity * it.unitPrice;
      const disc = gross * ((it.discount || 0) / 100);
      const net = gross - disc;
      const lineTax = net * ((it.taxPercent || 0) / 100);

      subtotal += gross;
      discount += disc;
      tax += lineTax;
    });

    return {
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax,
    };
  };

  const totals = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSupplierId) {
      setError('Pilih Supplier terlebih dahulu');
      return;
    }

    if (items.length === 0) {
      setError('PO harus memiliki minimal 1 item');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        prId: selectedPrId || null,
        supplierId: selectedSupplierId,
        deliveryDate: deliveryDate || null,
        paymentTerms,
        shippingTerms,
        currency: 'IDR',
        notes,
        purchaseType: 'VENDOR',
        items: items.map((it) => ({
          prItemId: it.prItemId,
          itemId: it.itemId,
          specification: it.specification,
          quantity: Number(it.quantity),
          unitId: it.unitId,
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxPercent: Number(it.taxPercent || 0),
        })),
      };

      const res = await api.post('/purchase-orders', payload);
      navigate(`/purchase-orders/${res.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal membuat Purchase Order');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/purchase-orders')}
          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Terbitkan Purchase Order (PO)
          </h1>
          <p className="text-xs text-slate-500">
            Formulir penerbitan pesanan pembelian resmi kepada vendor terpilih
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Informasi Header PO
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pilih Supplier / Vendor *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplierName} ({s.supplierCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Referensi PR (Opsional)</label>
              <select
                value={selectedPrId}
                onChange={(e) => setSelectedPrId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Tanpa Referensi PR</option>
                {prList.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.prNumber} - {pr.department?.departmentName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tenggat Pengiriman (Delivery Date)</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Terms Pembayaran</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="NET 30 / COD"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Terms Pengiriman</label>
              <input
                type="text"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(e.target.value)}
                placeholder="Franco Gudang Pabrik"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instruksi pengiriman..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>
          </div>
        </div>

        {/* PO Items Table */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Barang & Harga Satuan
            </h2>
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg border border-amber-200"
            >
              <Plus className="w-3.5 h-3.5" />
              + Tambah Baris
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Barang</th>
                  <th className="px-3 py-2.5">Spesifikasi</th>
                  <th className="px-3 py-2.5 text-right w-20">Qty</th>
                  <th className="px-3 py-2.5 w-16">Satuan</th>
                  <th className="px-3 py-2.5 text-right w-32">Harga Satuan (Rp)</th>
                  <th className="px-3 py-2.5 text-right w-20">Diskon (%)</th>
                  <th className="px-3 py-2.5 text-right w-20">PPN (%)</th>
                  <th className="px-3 py-2.5 text-right w-32">Subtotal</th>
                  <th className="px-3 py-2.5 w-12 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => {
                  const gross = row.quantity * row.unitPrice;
                  const net = gross - gross * ((row.discount || 0) / 100);
                  const lineTotal = net + net * ((row.taxPercent || 0) / 100);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <select
                          value={row.itemId}
                          onChange={(e) => updateItemRow(idx, 'itemId', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 outline-none text-xs"
                        >
                          {itemsMaster.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.itemCode} - {m.itemName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.specification}
                          onChange={(e) => updateItemRow(idx, 'specification', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 outline-none text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={row.quantity}
                          onChange={(e) => updateItemRow(idx, 'quantity', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-right font-bold outline-none text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{row.unitCode}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={row.unitPrice}
                          onChange={(e) => updateItemRow(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-right font-bold outline-none text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={row.discount}
                          onChange={(e) => updateItemRow(idx, 'discount', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-right outline-none text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={row.taxPercent}
                          onChange={(e) => updateItemRow(idx, 'taxPercent', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-right outline-none text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">
                        {formatCurrency(lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="pt-4 border-t border-slate-200 flex flex-col items-end text-xs space-y-1">
            <div className="flex justify-between w-64 text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between w-64 text-slate-600">
              <span>Total Diskon:</span>
              <span className="font-semibold text-emerald-700">-{formatCurrency(totals.discount)}</span>
            </div>
            <div className="flex justify-between w-64 text-slate-600">
              <span>Pajak (PPN):</span>
              <span className="font-semibold">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="flex justify-between w-64 pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
              <span>Total Nilai PO:</span>
              <span className="text-amber-700">{formatCurrency(totals.total)}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">
              *Backend server akan menghitung ulang seluruh nilai secara otomatis.
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Menyimpan...' : 'Simpan Draft Purchase Order'}
          </button>
        </div>
      </form>
    </div>
  );
};

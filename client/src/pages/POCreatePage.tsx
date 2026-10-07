import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  ArrowLeft,
  Save,
  ShoppingCart,
  Plus,
  Trash2,
  AlertCircle,
  CheckSquare,
  Square,
  Layers,
  Building,
  Calendar,
  Clock,
  Boxes,
  HelpCircle,
  Filter,
  CheckCircle2
} from 'lucide-react';

export const POCreatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [itemsMaster, setItemsMaster] = useState<any[]>([]);
  const [pendingPrItems, setPendingPrItems] = useState<any[]>([]);

  // Checklist state for PR items waiting for PO
  const [selectedPrItemIds, setSelectedPrItemIds] = useState<string[]>([]);
  const [filterVendorId, setFilterVendorId] = useState<string>('');
  const [filterPrNumber, setFilterPrNumber] = useState<string>('');

  // PO Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState(searchParams.get('supplierId') || '');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('NET 30');
  const [shippingTerms, setShippingTerms] = useState('Franco Gudang Pabrik');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load master data and pending PR items
  const loadInitialData = async () => {
    setFetchLoading(true);
    try {
      const [resSup, resItems, resPending] = await Promise.all([
        api.get('/suppliers'),
        api.get('/items'),
        api.get('/purchase-orders/pending-items'),
      ]);

      const supList = resSup.data.data || [];
      const pendingList = resPending.data.data || [];
      setSuppliers(supList);
      setItemsMaster(resItems.data.data || []);
      setPendingPrItems(pendingList);

      // If URL has prId or item id
      const initialPrId = searchParams.get('prId');
      const initialSupplierId = searchParams.get('supplierId');
      if (initialSupplierId) {
        setSelectedSupplierId(initialSupplierId);
      }

      if (initialPrId) {
        setFilterPrNumber(initialPrId);
        const matched = pendingList.filter((p: any) => p.prId === initialPrId || p.prNumber === initialPrId);
        if (matched.length > 0) {
          const matchedIds = matched.map((m: any) => m.id);
          setSelectedPrItemIds(matchedIds);
          syncCheckedToPOItems(pendingList, matchedIds, initialSupplierId || undefined);
        }
      }
    } catch (e) {
      console.error('Failed to load PO creation dependencies', e);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Synchronize checked PR items into PO items rows
  const syncCheckedToPOItems = (allCandidates: any[], checkedIds: string[], targetSupplierId?: string) => {
    const selected = allCandidates
      .filter((c) => checkedIds.includes(c.id))
      .map((c) => ({
        prItemId: c.id,
        prNumber: c.prNumber,
        itemId: c.itemId,
        itemName: c.itemName,
        itemCode: c.itemCode,
        specification: c.specification,
        quantity: c.purchaseQty,
        unitId: c.unitId,
        unitCode: c.unitCode,
        unitPrice: c.suggestedPrice || c.estimatedPrice || 0,
        discount: 0,
        taxPercent: 0,
      }));

    setItems(selected);

    // If auto-detecting vendor from selected items
    if (!targetSupplierId && !selectedSupplierId) {
      const firstWithVendor = allCandidates.find((c) => checkedIds.includes(c.id) && c.suggestedSupplierId);
      if (firstWithVendor) {
        setSelectedSupplierId(firstWithVendor.suggestedSupplierId);
      }
    }
  };

  // Toggle checklist for individual PR item
  const toggleItemCheck = (candidate: any) => {
    let nextChecked: string[];
    if (selectedPrItemIds.includes(candidate.id)) {
      nextChecked = selectedPrItemIds.filter((id) => id !== candidate.id);
    } else {
      nextChecked = [...selectedPrItemIds, candidate.id];

      // Auto-set vendor if not yet selected
      if (!selectedSupplierId && candidate.suggestedSupplierId) {
        setSelectedSupplierId(candidate.suggestedSupplierId);
      }
    }

    setSelectedPrItemIds(nextChecked);
    syncCheckedToPOItems(pendingPrItems, nextChecked);
  };

  // Toggle select all visible items
  const toggleSelectAllVisible = (visibleCandidates: any[]) => {
    const visibleIds = visibleCandidates.map((v) => v.id);
    const allVisibleChecked = visibleIds.every((id) => selectedPrItemIds.includes(id));

    let nextChecked: string[];
    if (allVisibleChecked) {
      nextChecked = selectedPrItemIds.filter((id) => !visibleIds.includes(id));
    } else {
      nextChecked = Array.from(new Set([...selectedPrItemIds, ...visibleIds]));
    }

    setSelectedPrItemIds(nextChecked);
    syncCheckedToPOItems(pendingPrItems, nextChecked);
  };

  // Manual row addition
  const addItemRow = () => {
    if (itemsMaster.length === 0) return;
    const def = itemsMaster[0];
    setItems([
      ...items,
      {
        prItemId: null,
        prNumber: null,
        itemId: def.id,
        itemName: def.itemName,
        itemCode: def.itemCode,
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
        copy[index].itemCode = selected.itemCode;
        copy[index].unitId = selected.unitId;
        copy[index].unitCode = selected.unitCode || selected.unit;
      }
    } else {
      copy[index][field] = val;
    }
    setItems(copy);
  };

  const removeItemRow = (index: number) => {
    const target = items[index];
    if (target?.prItemId) {
      setSelectedPrItemIds(selectedPrItemIds.filter((id) => id !== target.prItemId));
    }
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

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSupplierId) {
      setError('Pilih Supplier / Vendor terlebih dahulu');
      return;
    }

    if (items.length === 0) {
      setError('Pilih atau checklist minimal 1 item barang untuk diterbitkan dalam PO ini.');
      return;
    }

    setLoading(true);

    try {
      // Find primary PR ID if all items come from same PR, or first one
      const prIdsInPO = items.map((it) => it.prItemId).filter(Boolean);
      let primaryPrId: string | null = null;
      if (prIdsInPO.length > 0) {
        const firstMatch = pendingPrItems.find((p) => p.id === prIdsInPO[0]);
        if (firstMatch) primaryPrId = firstMatch.prId;
      }

      const payload = {
        prId: primaryPrId,
        supplierId: selectedSupplierId,
        deliveryDate: deliveryDate || null,
        paymentTerms,
        shippingTerms,
        currency: 'IDR',
        notes,
        purchaseType: 'VENDOR',
        items: items.map((it) => ({
          prItemId: it.prItemId || null,
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
      alert(`Purchase Order ${res.data.data.poNumber} berhasil diterbitkan. Item yang dipilih telah otomatis dikeluarkan dari antrean PO.`);
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

  // Filtered candidate list based on user filter controls
  const visibleCandidateItems = pendingPrItems.filter((it) => {
    if (filterVendorId && it.suggestedSupplierId !== filterVendorId) return false;
    if (filterPrNumber && !it.prNumber.toLowerCase().includes(filterPrNumber.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
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
            Pilih dan checklist item dari seluruh PR yang masuk untuk digabung ke dalam satu PO vendor
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
        {/* STEP 1: PO HEADER INFORMATION (VENDOR & TERMS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-600" />
            1. Vendor Tujuan & Ketentuan Purchase Order
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Supplier / Vendor Pembelian *
              </label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setFilterVendorId(e.target.value);
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-900"
              >
                <option value="">-- Pilih Supplier Vendor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplierName} ({s.supplierCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tenggat Pengiriman (Delivery Date)
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Terms Pembayaran
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="NET 30 / COD / DP 50%"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Terms Pengiriman (Shipping Terms)
              </label>
              <input
                type="text"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(e.target.value)}
                placeholder="Franco Gudang Pabrik / FOB"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Catatan Tambahan untuk Vendor
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instruksi nomor surat jalan, PIC penerima gudang..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>
          </div>
        </div>

        {/* STEP 2: POOL OF ALL INCOMING PR ITEMS WITH CHECKLIST (AUTO REMOVED ONCE ORDERED) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  2. Checklist Item dari Seluruh PR Masuk (Belum Diterbitkan PO)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[11px] font-bold">
                  {pendingPrItems.length} Item Menunggu PO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pilih barang dari PR mana saja yang bisa dibeli dari vendor ini. <strong>Item yang sudah dibuatkan PO-nya otomatis akan hilang dari list ini.</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSelectAllVisible(visibleCandidateItems)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
              >
                Centang / Batal Semua Visible
              </button>
              <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                {selectedPrItemIds.length} Item Dichecklist
              </span>
            </div>
          </div>

          {/* Quick Filter Bar for candidate items */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter Cepat:
            </span>
            <input
              type="text"
              placeholder="Cari nomor PR..."
              value={filterPrNumber}
              onChange={(e) => setFilterPrNumber(e.target.value)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none"
            />
            <select
              value={filterVendorId}
              onChange={(e) => setFilterVendorId(e.target.value)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none font-medium"
            >
              <option value="">Semua Rekomendasi Vendor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplierName}
                </option>
              ))}
            </select>
            {(filterPrNumber || filterVendorId) && (
              <button
                type="button"
                onClick={() => {
                  setFilterPrNumber('');
                  setFilterVendorId('');
                }}
                className="text-[11px] text-indigo-600 hover:underline font-bold"
              >
                Reset Filter
              </button>
            )}
          </div>

          {fetchLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Memuat antrean barang PR yang belum dibuatkan PO...
            </div>
          ) : visibleCandidateItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
              Tidak ada item PR yang menunggu PO sesuai filter saat ini. Seluruh item telah diterbitkan PO atau dialokasikan stok gudang.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-indigo-50/70 sticky top-0 border-b border-indigo-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center">Pilih</th>
                    <th className="px-3 py-2.5">Asal Dokumen PR</th>
                    <th className="px-3 py-2.5">Barang</th>
                    <th className="px-3 py-2.5">Spesifikasi</th>
                    <th className="px-3 py-2.5 text-right">Qty Beli</th>
                    <th className="px-3 py-2.5">Satuan</th>
                    <th className="px-3 py-2.5">Vendor Disarankan</th>
                    <th className="px-3 py-2.5 text-right">Harga Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCandidateItems.map((candidate) => {
                    const isChecked = selectedPrItemIds.includes(candidate.id);
                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => toggleItemCheck(candidate)}
                        className={`cursor-pointer transition ${
                          isChecked ? 'bg-indigo-50/50 hover:bg-indigo-50/80 font-medium' : 'hover:bg-slate-50 opacity-75'
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItemCheck(candidate)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold font-mono text-indigo-700">{candidate.prNumber}</div>
                          <div className="text-[10px] text-slate-400">
                            {candidate.requesterName} ({candidate.departmentName})
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">{candidate.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{candidate.itemCode}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-600 max-w-xs truncate">
                          {candidate.specification || '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-black text-purple-700 text-sm">
                          {candidate.purchaseQty}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-600">
                          {candidate.unitCode}
                        </td>
                        <td className="px-3 py-3">
                          {candidate.suggestedSupplierName ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {candidate.suggestedSupplierName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800">
                          {formatCurrency(candidate.suggestedPrice || candidate.estimatedPrice || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* STEP 3: FINAL PO ITEMS TABLE (INCLUDED IN THIS PO) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-600" />
                3. Rincian Item PO Yang Diterbitkan ({items.length} Item Terpilih)
              </h2>
              <span className="text-[11px] text-slate-400">
                Item otomatis tersinkron dari checklist di atas. Anda dapat menyesuaikan harga nego final, diskon, dan PPN.
              </span>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg border border-amber-200"
            >
              <Plus className="w-3.5 h-3.5" />
              + Tambah Baris Manual
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
              Belum ada item yang dichecklist untuk PO ini. Silakan centang barang pada tabel Checklist di atas atau klik Tambah Baris Manual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Ref. PR</th>
                    <th className="px-3 py-2.5">Barang</th>
                    <th className="px-3 py-2.5">Spesifikasi</th>
                    <th className="px-3 py-2.5 text-right w-24">Qty Beli</th>
                    <th className="px-3 py-2.5 w-16">Satuan</th>
                    <th className="px-3 py-2.5 text-right w-36">Harga Satuan (Rp)</th>
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
                        <td className="px-3 py-2 font-mono text-[11px] font-bold text-indigo-700">
                          {row.prNumber || '-'}
                        </td>
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
                            className="w-full border border-slate-300 rounded px-2 py-1 text-right font-black outline-none text-xs"
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
                        <td className="px-3 py-2 text-right font-black text-slate-900">
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
          )}

          {/* Totals Summary */}
          {items.length > 0 && (
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
                *Item yang terbit PO otomatis hilang dari daftar antrean PR, dan dapat kembali jika PO dihapus.
              </span>
            </div>
          )}
        </div>

        {/* Submit Actions */}
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
            disabled={loading || items.length === 0}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Menyimpan...' : 'Simpan & Terbitkan PO'}
          </button>
        </div>
      </form>
    </div>
  );
};

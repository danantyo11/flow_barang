import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { ArrowLeft, Save, PackageCheck, AlertCircle, Sparkles } from 'lucide-react';

export const ReceivingCreatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [openPOs, setOpenPOs] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(searchParams.get('poId') || '');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [destination, setDestination] = useState<'STOCK' | 'USER_REQUEST'>('STOCK');
  const [qcStatus, setQcStatus] = useState<'PASSED' | 'PARTIAL' | 'REJECTED'>('PASSED');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [resPos, resWhs] = await Promise.all([
          api.get('/purchase-orders'),
          api.get('/warehouses'),
        ]);

        const allPos = resPos.data.data || [];
        // Only POs that can be received (APPROVED, SENT, PARTIALLY_RECEIVED)
        const receivable = allPos.filter((p: any) =>
          ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(p.status)
        );
        setOpenPOs(receivable);
        setWarehouses(resWhs.data.data || []);

        const targetPoId = searchParams.get('poId');
        if (targetPoId) {
          const po = allPos.find((p: any) => p.id === targetPoId);
          if (po) handleSelectPO(po, resWhs.data.data || []);
        } else if (receivable.length > 0) {
          handleSelectPO(receivable[0], resWhs.data.data || []);
        }
      } catch (e) {
        console.error('Failed to load receiving data', e);
      }
    };
    loadData();
  }, []);

  const handleSelectPO = (po: any, whList: any[]) => {
    setSelectedPoId(po.id);
    const defaultWh = whList.length > 0 ? whList[0] : null;
    const defaultLoc = defaultWh?.locations?.length > 0 ? defaultWh.locations[0] : null;

    const prepared = (po.items || [])
      .filter((it: any) => it.quantity > 0)
      .map((it: any) => {
      const remaining = it.remainingQty !== undefined ? it.remainingQty : it.quantity;
      return {
        poItemId: it.id,
        itemId: it.itemId,
        itemName: it.item?.itemName,
        warehouseId: defaultWh?.id || '',
        locationId: defaultLoc?.id || '',
        orderQty: it.quantity,
        receivedQty: remaining,
        goodQty: remaining,
        damagedQty: 0,
        rejectedQty: 0,
        notes: '',
      };
    });
    setItems(prepared);
  };

  const handleQtyChange = (
    index: number,
    field: 'receivedQty' | 'goodQty' | 'damagedQty' | 'rejectedQty',
    val: number
  ) => {
    const copy = [...items];
    const row = copy[index];
    row[field] = Math.max(0, val);

    // Auto adjust goodQty if receivedQty changed
    if (field === 'receivedQty') {
      row.goodQty = Math.max(0, val - (row.damagedQty + row.rejectedQty));
    }

    setItems(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate QC integrity
    for (const it of items) {
      if (it.goodQty + it.damagedQty + it.rejectedQty > it.receivedQty) {
        setError(`Jumlah QC (Baik + Rusak + Tolak) untuk "${it.itemName}" melebihi Qty Diterima (${it.receivedQty})`);
        return;
      }
      if (destination === 'STOCK' && !it.warehouseId) {
        setError(`Pilih gudang tujuan untuk barang "${it.itemName}"`);
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        poId: selectedPoId || null,
        deliveryNoteNumber: deliveryNote,
        invoiceNumber: invoiceNumber,
        destination,
        qcStatus,
        notes,
        items: items.map((it) => ({
          poItemId: it.poItemId,
          itemId: it.itemId,
          warehouseId: it.warehouseId || null,
          locationId: it.locationId || null,
          orderQty: Number(it.orderQty),
          receivedQty: Number(it.receivedQty),
          goodQty: Number(it.goodQty),
          damagedQty: Number(it.damagedQty || 0),
          rejectedQty: Number(it.rejectedQty || 0),
          notes: it.notes,
        })),
      };

      await api.post('/goods-receipts', payload);
      alert('Penerimaan barang & QC berhasil diproses!');
      navigate('/goods-receipts');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memproses penerimaan barang');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/goods-receipts')}
          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Penerimaan Barang & Quality Check (GR / QC)
          </h1>
          <p className="text-xs text-slate-500">
            Formulir penerimaan fisik dari vendor, inspeksi QC barang baik/rusak, dan posting stok
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* QC Rule Reminder (Section 16 & 17) */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-emerald-950 block">Aturan Quality Check & Stock Engine:</span>
          <p className="mt-0.5">
            Barang rusak (Damaged) atau ditolak (Rejected) <strong>TIDAK PERNAH</strong> dimasukkan ke dalam stok gudang yang tersedia. Hanya <strong>Good Qty</strong> yang diposting ke ledger stok atau diteruskan ke user.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Informasi Dokumen Penerimaan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pilih Purchase Order (PO) *</label>
              <select
                required
                value={selectedPoId}
                onChange={(e) => {
                  const po = openPOs.find((p) => p.id === e.target.value);
                  if (po) handleSelectPO(po, warehouses);
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Pilih PO yang akan diterima --</option>
                {openPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} - {po.supplier?.supplierName} ({po.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Surat Jalan (Delivery Note)</label>
              <input
                type="text"
                required
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="DN-VENDOR-XXXX"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Faktur / Invoice</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-XXXX"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Destinasi Barang (Section 17)</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none font-bold text-slate-800"
              >
                <option value="STOCK">STOCK → Barang Masuk Saldo Stok Gudang</option>
                <option value="USER_REQUEST">USER_REQUEST → Khusus Pemohon (Pending Handover)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hasil Inspeksi QC Keseluruhan</label>
              <select
                value={qcStatus}
                onChange={(e) => setQcStatus(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none font-bold"
              >
                <option value="PASSED">PASSED (100% Lolos Inspeksi)</option>
                <option value="PARTIAL">PARTIAL (Sebagian Rusak / Cacat)</option>
                <option value="REJECTED">REJECTED (Ditolak Total)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Item QC Table */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Inspeksi Kuantitas Barang per Item
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Barang</th>
                  <th className="px-3 py-2.5 text-right w-20">Order Qty</th>
                  <th className="px-3 py-2.5 text-right w-24 text-blue-700">Diterima Fisik</th>
                  <th className="px-3 py-2.5 text-right w-24 text-emerald-700">Kondisi Baik</th>
                  <th className="px-3 py-2.5 text-right w-24 text-amber-700">Rusak</th>
                  <th className="px-3 py-2.5 text-right w-24 text-rose-700">Ditolak</th>
                  <th className="px-3 py-2.5 w-36">Gudang</th>
                  <th className="px-3 py-2.5">Catatan QC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 font-bold text-slate-900">{row.itemName}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700">{row.orderQty}</td>
                    <td className="px-3 py-3 text-right bg-blue-50/40">
                      <input
                        type="number"
                        min="0"
                        value={row.receivedQty}
                        onChange={(e) => handleQtyChange(idx, 'receivedQty', Number(e.target.value))}
                        className="w-20 text-right border border-blue-300 rounded px-2 py-1 font-bold text-blue-900 outline-none"
                      />
                    </td>
                    <td className="px-3 py-3 text-right bg-emerald-50/40">
                      <input
                        type="number"
                        min="0"
                        value={row.goodQty}
                        onChange={(e) => handleQtyChange(idx, 'goodQty', Number(e.target.value))}
                        className="w-20 text-right border border-emerald-300 rounded px-2 py-1 font-bold text-emerald-900 outline-none"
                      />
                    </td>
                    <td className="px-3 py-3 text-right bg-amber-50/40">
                      <input
                        type="number"
                        min="0"
                        value={row.damagedQty}
                        onChange={(e) => handleQtyChange(idx, 'damagedQty', Number(e.target.value))}
                        className="w-20 text-right border border-amber-300 rounded px-2 py-1 font-bold text-amber-900 outline-none"
                      />
                    </td>
                    <td className="px-3 py-3 text-right bg-rose-50/40">
                      <input
                        type="number"
                        min="0"
                        value={row.rejectedQty}
                        onChange={(e) => handleQtyChange(idx, 'rejectedQty', Number(e.target.value))}
                        className="w-20 text-right border border-rose-300 rounded px-2 py-1 font-bold text-rose-900 outline-none"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={row.warehouseId}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].warehouseId = e.target.value;
                          setItems(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-2 py-1 outline-none text-xs"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.warehouseName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        placeholder="Keterangan..."
                        value={row.notes}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].notes = e.target.value;
                          setItems(copy);
                        }}
                        className="w-full border border-slate-200 rounded px-2 py-1 outline-none text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/goods-receipts')}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <PackageCheck className="w-4 h-4" />
            {loading ? 'Memproses...' : 'Posting Penerimaan Barang (GR)'}
          </button>
        </div>
      </form>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useOffline } from '../context/OfflineContext.js';
import { OfflineStorage } from '../services/offlineStorage.js';
import { Plus, Trash2, ArrowLeft, Save, Send, AlertTriangle } from 'lucide-react';

interface PRItemInput {
  itemId: string;
  itemName: string;
  specification: string;
  requestedQty: number;
  unitId: string;
  unitCode: string;
  estimatedPrice: number;
  notes: string;
}

export const PRCreatePage: React.FC = () => {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const navigate = useNavigate();

  const [itemsMaster, setItemsMaster] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState(user?.departmentId || '');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'CRITICAL'>('NORMAL');
  const [purpose, setPurpose] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PRItemInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMaster = async () => {
      try {
        if (isOnline) {
          const [resItems, resDepts] = await Promise.all([
            api.get('/items'),
            api.get('/auth/departments'),
          ]);
          setItemsMaster(resItems.data.data || []);
          setDepartments(resDepts.data.data || []);
          OfflineStorage.cacheItems(resItems.data.data || []);
        } else {
          setItemsMaster(OfflineStorage.getCachedItems());
        }
      } catch (e) {
        setItemsMaster(OfflineStorage.getCachedItems());
      }
    };
    loadMaster();
  }, [isOnline]);

  const addItemRow = () => {
    if (itemsMaster.length === 0) return;
    const defaultItem = itemsMaster[0];
    setItems([
      ...items,
      {
        itemId: defaultItem.id,
        itemName: defaultItem.itemName,
        specification: defaultItem.specification || '',
        requestedQty: 1,
        unitId: defaultItem.unitId,
        unitCode: defaultItem.unitCode || defaultItem.unit,
        estimatedPrice: 0,
        notes: '',
      },
    ]);
  };

  const updateItemRow = (index: number, field: keyof PRItemInput, val: any) => {
    const copy = [...items];
    if (field === 'itemId') {
      const selected = itemsMaster.find((it) => it.id === val);
      if (selected) {
        copy[index].itemId = selected.id;
        copy[index].itemName = selected.itemName;
        copy[index].specification = selected.specification || '';
        copy[index].unitId = selected.unitId;
        copy[index].unitCode = selected.unitCode || selected.unit;
      }
    } else {
      copy[index][field] = val as never;
    }
    setItems(copy);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (isDraft: boolean) => {
    setError(null);
    if (items.length === 0) {
      setError('PR wajib memiliki minimal 1 item barang');
      return;
    }

    for (const item of items) {
      if (!item.requestedQty || item.requestedQty <= 0) {
        setError(`Jumlah kuantitas untuk "${item.itemName}" harus lebih dari 0`);
        return;
      }
    }

    const payload = {
      departmentId: selectedDeptId,
      priority,
      purpose,
      requiredDate: requiredDate || null,
      notes,
      isDraft,
      items: items.map((it) => ({
        itemId: it.itemId,
        specification: it.specification,
        requestedQty: Number(it.requestedQty),
        unitId: it.unitId,
        estimatedPrice: Number(it.estimatedPrice || 0),
        notes: it.notes,
      })),
    };

    setLoading(true);

    try {
      if (!isOnline) {
        // Save draft locally in offline mode
        OfflineStorage.saveDraftPR(payload);
        alert('Anda sedang offline. Draft PR telah disimpan di memori perangkat dan akan disinkronkan otomatis begitu online kembali.');
        navigate('/purchase-requests');
        return;
      }

      await api.post('/purchase-requests', payload);
      navigate('/purchase-requests');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menyimpan Permintaan Barang');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/purchase-requests')}
          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Buat Permintaan Barang (PR)
          </h1>
          <p className="text-xs text-slate-500">
            Formulir resmi pengadaan kebutuhan internal divisi
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Form */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Informasi Permintaan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Departemen / Divisi</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.departmentName} ({d.departmentCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Prioritas</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="NORMAL">NORMAL (Pengadaan Reguler)</option>
              <option value="URGENT">URGENT (Mendesak / Jadwal Terjadwal)</option>
              <option value="CRITICAL">CRITICAL (Berpotensi Ganggu Operasional/Kowi)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Dibutuhkan</label>
            <input
              type="date"
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tujuan / Keperluan Barang</label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Contoh: Penggantian bearing motor gearbox line konveyor utama yang aus"
              className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan instruksi khusus atau lampiran..."
              className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Detail Items Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Daftar Barang yang Diminta
          </h2>
          <button
            type="button"
            onClick={addItemRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg border border-amber-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            + Tambah Baris Barang
          </button>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2.5 w-1/4">Barang</th>
                  <th className="px-3 py-2.5 w-1/4">Spesifikasi</th>
                  <th className="px-3 py-2.5 w-24">Jumlah</th>
                  <th className="px-3 py-2.5 w-20">Satuan</th>
                  <th className="px-3 py-2.5 w-32">Est. Harga (Rp)</th>
                  <th className="px-3 py-2.5">Catatan</th>
                  <th className="px-3 py-2.5 w-12 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <select
                        value={row.itemId}
                        onChange={(e) => updateItemRow(idx, 'itemId', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none"
                      >
                        {itemsMaster.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.itemCode} - {m.itemName} {m.isCritical ? '⚠️ [KRITIS/KOWI]' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.specification}
                        onChange={(e) => updateItemRow(idx, 'specification', e.target.value)}
                        placeholder="Spesifikasi..."
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.requestedQty}
                        onChange={(e) => updateItemRow(idx, 'requestedQty', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-700">
                      {row.unitCode}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={row.estimatedPrice}
                        onChange={(e) => updateItemRow(idx, 'estimatedPrice', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateItemRow(idx, 'notes', e.target.value)}
                        placeholder="Catatan..."
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none"
                      />
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-xs text-slate-500">Belum ada barang ditambahkan dalam tabel.</p>
            <button
              type="button"
              onClick={addItemRow}
              className="mt-2 text-xs font-bold text-amber-700 hover:underline"
            >
              + Klik di sini untuk menambahkan barang
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSubmit(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
        >
          <Save className="w-4 h-4" />
          Simpan sebagai Draft
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSubmit(false)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Memproses...' : 'Submit ke Gudang'}
        </button>
      </div>
    </div>
  );
};

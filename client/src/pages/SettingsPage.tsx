import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Settings, Save, ShieldCheck } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data || {});
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      await api.put(`/settings/${key}`, { value: settings[key] });
      alert(`Pengaturan ${key} berhasil diperbarui.`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pengaturan Sistem (System Configuration)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Konfigurasi parameter kebijakan bisnis, stok negatif, dan profil perusahaan
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-3xl">
        {/* Negative Stock Setting */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="font-bold text-sm text-slate-900 block">
              Izinkan Stok Negatif (ALLOW_NEGATIVE_STOCK)
            </span>
            <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
              Jika nonaktif (false), stock engine akan menolak transaksi pengeluaran (Issue) apabila stok tidak mencukupi, mencegah saldo persediaan menjadi negatif (Section 39).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={settings['ALLOW_NEGATIVE_STOCK'] || 'false'}
              onChange={(e) => handleChange('ALLOW_NEGATIVE_STOCK', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
            >
              <option value="false">TIDAK (Direkomendasikan)</option>
              <option value="true">YA (Izinkan)</option>
            </select>
            <button
              onClick={() => handleSave('ALLOW_NEGATIVE_STOCK')}
              disabled={saving}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Require QC Setting */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="font-bold text-sm text-slate-900 block">
              Wajib Inspeksi QC pada Receiving (REQUIRE_QC_INSPECTION)
            </span>
            <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
              Setiap penerimaan barang wajib melalui inspeksi QC (Passed, Partial, Rejected).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={settings['REQUIRE_QC_INSPECTION'] || 'true'}
              onChange={(e) => handleChange('REQUIRE_QC_INSPECTION', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
            >
              <option value="true">YA (Wajib QC)</option>
              <option value="false">TIDAK</option>
            </select>
            <button
              onClick={() => handleSave('REQUIRE_QC_INSPECTION')}
              disabled={saving}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Company Name */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="font-bold text-sm text-slate-900 block">
              Nama Perusahaan (COMPANY_NAME)
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Identitas perusahaan pada header PO dan cetakan laporan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={settings['COMPANY_NAME'] || ''}
              onChange={(e) => handleChange('COMPANY_NAME', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none w-52"
            />
            <button
              onClick={() => handleSave('COMPANY_NAME')}
              disabled={saving}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

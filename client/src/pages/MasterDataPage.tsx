import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Boxes, Truck, Building2, Users, Plus, AlertTriangle, Sparkles } from 'lucide-react';

export const MasterDataPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'suppliers' | 'warehouses' | 'users'>('items');

  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resItems, resSup, resWh, resUsers] = await Promise.all([
        api.get('/items'),
        api.get('/suppliers'),
        api.get('/warehouses'),
        api.get('/auth/users'),
      ]);
      setItems(resItems.data.data || []);
      setSuppliers(resSup.data.data || []);
      setWarehouses(resWh.data.data || []);
      setUsers(resUsers.data.data || []);
    } catch (e) {
      console.error('Failed to load master data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Master Data Perusahaan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelolaan data induk barang & material penunjang (Kowi), supplier, gudang multi-lokasi, dan pengguna
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Barang & Kowi ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'suppliers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Supplier ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'warehouses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Gudang ({warehouses.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Pengguna ({users.length})
          </button>
        </div>
      </div>

      {/* Tab: Items */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Section 38 Kowi Highlight */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950 block">Ketentuan Bisnis Khusus Kowi (Section 38):</span>
              <p className="mt-0.5">
                <strong>Kowi</strong> diklasifikasikan sebagai <em>Sparepart / Production Supporting Material</em> dan bertatus <strong>Critical = YA</strong> karena ketiadaan Kowi dapat menghentikan kelangsungan peleburan dan operasional pabrik.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Spesifikasi & Merek</th>
                    <th className="px-4 py-3 text-right">Min / Max</th>
                    <th className="px-4 py-3 text-right">Critical Level</th>
                    <th className="px-4 py-3">Satuan</th>
                    <th className="px-4 py-3">Klasifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 font-bold text-amber-800">{it.itemCode}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {it.itemName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-semibold">{it.category}</td>
                      <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">
                        {it.specification || '-'} {it.brand ? `(${it.brand})` : ''}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                        {it.minimumStock} / {it.maximumStock}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-rose-700">
                        {it.criticalStock}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">{it.unit}</td>
                      <td className="px-4 py-3.5">
                        {it.isCritical ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            ⚠️ KRITIS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Reguler
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Suppliers */}
      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Supplier</th>
                  <th className="px-4 py-3">Kontak Person</th>
                  <th className="px-4 py-3">Telepon & Email</th>
                  <th className="px-4 py-3">Lead Time</th>
                  <th className="px-4 py-3">Terms Pembayaran</th>
                  <th className="px-4 py-3">NPWP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 font-bold text-cyan-800">{s.supplierCode}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{s.supplierName}</td>
                    <td className="px-4 py-3.5 text-slate-700">{s.contactPerson || '-'}</td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {s.phone} {s.email ? `• ${s.email}` : ''}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{s.leadTimeDays} Hari</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">{s.paymentTerms || '-'}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">{s.taxNumber || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Warehouses */}
      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {w.warehouseCode}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">{w.warehouseName}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {w.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{w.address || 'Kawasan Fasilitas Perusahaan'}</p>

              <div className="pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Struktur Rak & Bin Lokasi (Section 6):
                </span>
                <div className="space-y-1.5">
                  {w.locations?.map((loc: any) => (
                    <div key={loc.id} className="p-2 bg-slate-50 rounded-lg text-xs flex justify-between items-center border border-slate-100">
                      <span className="font-semibold text-slate-800">{loc.locationName}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {loc.rack} • {loc.bin}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">NIP / No Pegawai</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Email Akun</th>
                  <th className="px-4 py-3">Divisi / Departemen</th>
                  <th className="px-4 py-3">Jabatan</th>
                  <th className="px-4 py-3">Hak Akses (Role RBAC)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-slate-700">
                      {u.employeeNumber}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">{u.department}</td>
                    <td className="px-4 py-3.5 text-slate-500">{u.position || '-'}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

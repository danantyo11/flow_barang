import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import {
  Search,
  Clock,
  AlertCircle,
  ArrowRight,
  Boxes,
  Layers,
  History,
  RotateCcw
} from 'lucide-react';

export const TrackingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTrackingNumber, setActiveTrackingNumber] = useState(initialQuery);
  const [recentPRs, setRecentPRs] = useState<any[]>([]);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch recent trackable items
  const fetchRecentItems = async () => {
    setSearchLoading(true);
    try {
      const res = await api.get('/tracking/search');
      setRecentPRs(res.data.data || []);
    } catch (err) {
      console.error('Failed to load recent PRs', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch detailed tracking for a document
  const fetchTracking = async (docNum: string) => {
    if (!docNum) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/tracking/${encodeURIComponent(docNum.trim())}`);
      setTrackingData(res.data.data);
      setActiveTrackingNumber(docNum.trim());
      setSearchParams({ q: docNum.trim() });
    } catch (err: any) {
      setError(err.response?.data?.message || `Dokumen '${docNum}' tidak ditemukan dalam alur tracking.`);
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentItems();
    if (initialQuery) {
      fetchTracking(initialQuery);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    fetchTracking(searchQuery);
  };

  const selectDocument = (num: string) => {
    setSearchQuery(num);
    fetchTracking(num);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5" /> Live Lifecycle Tracker
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Status Tracking Pengadaan & Logistik
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed">
            Lacak posisi dan riwayat dokumen pengadaan secara real-time dari Permintaan Barang (PR), Cek Gudang, Sourcing, Persetujuan PO, Penerimaan QC, hingga Serah Terima ke User.
          </p>

          {/* Form Pencarian Dokumen */}
          <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Masukkan Nomor PR (PR-...), PO (PO-...), GR (GR-...), atau Serah Terima (HO-...)"
                className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white/15 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" /> Melacak...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Lacak Status
                </>
              )}
            </button>
          </form>

          {/* Quick pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px]">Contoh Cepat:</span>
            {['PR-202610-0001', 'PR-202610-0003', 'PR-202610-0002', 'PO-202610-0001'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => selectDocument(num)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-slate-200 text-[11px] font-mono transition"
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Ambient background ornament */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <div>
            <p className="font-bold">Dokumen Tidak Ditemukan</p>
            <p className="text-slate-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main Tracking Content */}
      {trackingData && (
        <div className="space-y-6">
          {/* Overview Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {trackingData.pr?.prNumber}
                  </span>
                  <StatusBadge status={trackingData.pr?.status} />
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      trackingData.pr?.priority === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : trackingData.pr?.priority === 'URGENT'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {trackingData.pr?.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>Diajukan oleh <strong className="text-slate-700">{trackingData.pr?.requester?.name}</strong> ({trackingData.pr?.department?.departmentName})</span>
                  <span>•</span>
                  <span>{new Date(trackingData.pr?.requestDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}</span>
                </p>
              </div>

              {/* Progress percentage bar */}
              <div className="md:w-72">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-700">Progres Keseluruhan</span>
                  <span className="text-xs font-black text-indigo-600">{trackingData.progressPercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      trackingData.isCompleted
                        ? 'bg-emerald-500'
                        : trackingData.isRejected || trackingData.isCancelled
                        ? 'bg-rose-500'
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${trackingData.progressPercentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block text-right">
                  {trackingData.isCompleted ? 'Selesai diserahterimakan' : 'Dalam proses pengadaan'}
                </span>
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-semibold text-[10px] uppercase block">Keperluan / Proyek</span>
                <p className="font-bold text-slate-800 mt-1 line-clamp-2">{trackingData.pr?.purpose || '-'}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-semibold text-[10px] uppercase block">Purchase Order (PO)</span>
                {trackingData.pr?.purchaseOrders?.length > 0 ? (
                  <div className="mt-1">
                    {trackingData.pr.purchaseOrders.map((po: any) => (
                      <Link
                        key={po.id}
                        to={`/purchase-orders/${po.id}`}
                        className="text-indigo-600 font-bold hover:underline block"
                      >
                        {po.poNumber} ({po.status})
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="font-semibold text-slate-400 mt-1">Belum Terbit</p>
                )}
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-semibold text-[10px] uppercase block">Penerimaan Gudang (GR)</span>
                {trackingData.pr?.purchaseOrders?.flatMap((p: any) => p.goodsReceipts)?.length > 0 ? (
                  <div className="mt-1">
                    {trackingData.pr.purchaseOrders.flatMap((p: any) => p.goodsReceipts).map((gr: any) => (
                      <span key={gr.id} className="text-emerald-700 font-bold block">
                        {gr.grNumber} • QC {gr.qcStatus}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-semibold text-slate-400 mt-1">Menunggu Pengiriman</p>
                )}
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-semibold text-[10px] uppercase block">Serah Terima (HO)</span>
                {trackingData.pr?.handovers?.length > 0 ? (
                  <div className="mt-1">
                    {trackingData.pr.handovers.map((ho: any) => (
                      <Link
                        key={ho.id}
                        to={`/handovers/${ho.id}`}
                        className="text-teal-700 font-bold hover:underline block"
                      >
                        {ho.hoNumber} ({ho.status})
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="font-semibold text-slate-400 mt-1">Belum Terlaksana</p>
                )}
              </div>
            </div>
          </div>

          {/* Items Breakdown Table with Allocation Status */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-slate-500" />
                Status Per Item Barang Dalam PR Ini
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {trackingData.pr?.items?.length || 0} Jenis Barang
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Kode & Nama Barang</th>
                    <th className="px-4 py-3 text-right">Qty Diminta</th>
                    <th className="px-4 py-3 text-right text-blue-700">Stok Gudang</th>
                    <th className="px-4 py-3 text-right text-emerald-700">Dialokasikan</th>
                    <th className="px-4 py-3 text-right text-purple-700">Dibeli Sourcing</th>
                    <th className="px-4 py-3">Satuan</th>
                    <th className="px-4 py-3">Status Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trackingData.pr?.items?.map((it: any) => (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{it.item?.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.item?.itemCode}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900">
                        {it.requestedQty}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-blue-700">
                        {it.availableStock}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-700 bg-emerald-50/40">
                        {it.allocatedQty}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-purple-700 bg-purple-50/40">
                        {it.purchaseQty}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-600">
                        {it.unit?.code || it.unit?.name}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={it.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs & Action Trail */}
          {trackingData.auditLogs?.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                Audit Trail & Jejak Aktivitas Dokumen
              </h3>
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-2">
                {trackingData.auditLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                        {log.action}
                      </span>
                      <div>
                        <span className="font-bold text-slate-800">{log.documentNumber || log.module}</span>
                        <span className="text-slate-400 text-[11px] ml-2">oleh {log.userName}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Select Table of Recent PRs if no active search */}
      {!trackingData && !loading && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            Daftar Permintaan Terbaru Untuk Dilacak
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Nomor PR</th>
                  <th className="px-4 py-3">Pemohon</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">Keperluan</th>
                  <th className="px-4 py-3">Status Saat Ini</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPRs.map((pr: any) => (
                  <tr key={pr.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-bold font-mono text-indigo-600">
                      {pr.prNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-800 font-medium">
                      {pr.requester?.name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {pr.department?.departmentName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">
                      {pr.purpose || '-'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={pr.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => selectDocument(pr.prNumber)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition"
                      >
                        Lacak Status <ArrowRight className="w-3 h-3" />
                      </button>
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

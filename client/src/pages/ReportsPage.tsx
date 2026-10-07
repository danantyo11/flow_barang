import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { BarChart3, Download, Printer, FileSpreadsheet, Loader2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('pr');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const reportOptions = [
    { value: 'pr', label: '1. Laporan Permintaan Barang (PR)' },
    { value: 'po', label: '2. Laporan Purchase Order (PO)' },
    { value: 'outstanding-po', label: '3. Laporan Outstanding PO' },
    { value: 'stock', label: '4. Laporan Stok Barang' },
    { value: 'critical-stock', label: '5. Laporan Barang Kritis & Kebutuhan Reorder' },
    { value: 'receiving', label: '6. Laporan Penerimaan Barang (GR)' },
    { value: 'goods-issue', label: '7. Laporan Pengeluaran Barang (GI)' },
    { value: 'handover', label: '8. Laporan Serah Terima Barang (HO)' },
  ];

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${reportType}`);
      setReportData(res.data);
    } catch (e) {
      console.error('Failed to load report', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handleExportExcel = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/reports/${reportType}?format=excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}-report-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      alert('Gagal mendownload file Excel laporan');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pusat Laporan Terpadu (Reports & Analytics)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Unduh laporan operasional pengadaan, penerimaan, dan persediaan dalam format Excel dan PDF
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            Cetak PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export ke Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Select Report Type */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Pilih Jenis Laporan (Section 25)
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
          >
            {reportOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 font-medium block">Total Baris Data</span>
          <span className="text-base font-black text-slate-900">{reportData?.count || 0} Record</span>
        </div>
      </div>

      {/* Report Data Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {reportData?.title || 'Preview Data Laporan'}
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">Format: Tabular Ledger</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat laporan...</div>
        ) : reportData?.data && reportData.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  {Object.keys(reportData.data[0]).map((key, idx) => (
                    <th key={idx} className="px-4 py-3">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.data.map((row: any, rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-slate-50/50 transition">
                    {Object.values(row).map((val: any, cIdx: number) => (
                      <td key={cIdx} className="px-4 py-3.5 text-slate-700">
                        {typeof val === 'number' && val > 1000
                          ? new Intl.NumberFormat('id-ID').format(val)
                          : String(val ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Tidak ada data untuk laporan ini</p>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, FileText, ShoppingCart, Truck, Box, PackageCheck } from 'lucide-react';
import { api } from '../../services/api.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(res.data.results || []);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (link: string) => {
    onClose();
    navigate(link);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'PR':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'PO':
        return <ShoppingCart className="w-5 h-5 text-amber-600" />;
      case 'GR':
        return <PackageCheck className="w-5 h-5 text-emerald-600" />;
      case 'BARANG':
        return <Box className="w-5 h-5 text-purple-600" />;
      case 'SUPPLIER':
        return <Truck className="w-5 h-5 text-cyan-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-base"
            placeholder="Cari PR, PO, GR, GI, Kode Barang, Supplier, atau Pemohon..."
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 className="w-4 h-4 text-amber-600 animate-spin mr-2" />}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelect(r.link)}
                  className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition"
                >
                  <div className="p-2 bg-slate-100 rounded-lg mr-3">{getIcon(r.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 truncate">{r.title}</span>
                      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                        {r.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{r.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Tidak ada hasil yang ditemukan untuk "{query}".
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              Ketik minimal 2 karakter untuk memulai pencarian global.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

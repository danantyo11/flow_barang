import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { ShieldCheck, UserCheck, Warehouse, ShoppingCart, CheckSquare, BarChart, ArrowRight, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login gagal. Periksa kembali email dan kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/login', { email: demoEmail, password: demoPass });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal login demo');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: 'ADMIN',
      name: 'System Admin',
      email: 'admin@golden.local',
      pass: 'admin123',
      desc: 'Master data, user role, setting, audit',
      icon: ShieldCheck,
      color: 'bg-red-50 text-red-700 border-red-200',
    },
    {
      role: 'REQUESTER',
      name: 'Budi Maintenance',
      email: 'budi.maintenance@golden.local',
      pass: 'user123',
      desc: 'Buat PR, lacak status, serah terima',
      icon: UserCheck,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      role: 'WAREHOUSE',
      name: 'Joko Gudang',
      email: 'gudang@golden.local',
      pass: 'user123',
      desc: 'Cek stok, receiving, pengeluaran, QC',
      icon: Warehouse,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      role: 'PURCHASING',
      name: 'Siti Purchasing',
      email: 'purchasing@golden.local',
      pass: 'user123',
      desc: 'Quotation, perbandingan vendor, PO',
      icon: ShoppingCart,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      role: 'APPROVER',
      name: 'Hendra Manager',
      email: 'approver@golden.local',
      pass: 'user123',
      desc: 'Approval matrix berjenjang PO',
      icon: CheckSquare,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      role: 'MANAGEMENT',
      name: 'Dewi Management',
      email: 'management@golden.local',
      pass: 'user123',
      desc: 'Dashboard nilai spending & laporan',
      icon: BarChart,
      color: 'bg-slate-50 text-slate-700 border-slate-200',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-amber-500/20 mb-3">
          G
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          GOLDEN PROCUREMENT SYSTEM
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Integrated Procurement, Warehouse & Stock Ledger ERP
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Akun</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@golden.local"
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Kata Sandi</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Masuk ke Sistem'}
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center mb-4">
              Demo Akses Cepat (1-Click Login per Role)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {demoAccounts.map((d, i) => {
                const Icon = d.icon;
                return (
                  <button
                    key={i}
                    onClick={() => quickLogin(d.email, d.pass)}
                    className={`flex items-start p-2.5 rounded-xl border text-left transition hover:shadow-md hover:scale-[1.01] ${d.color}`}
                  >
                    <Icon className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{d.name}</span>
                        <ArrowRight className="w-3 h-3 opacity-60" />
                      </div>
                      <span className="text-[10px] opacity-75 block truncate">{d.role}</span>
                      <span className="text-[9px] opacity-70 block truncate mt-0.5">{d.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

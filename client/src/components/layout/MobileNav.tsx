import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, FileText, Boxes, Bell, User, PlusCircle, CheckCircle2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const MobileNav: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.roleName;

  return (
    <>
      {/* Quick Action Bar for Mobile Touch (Section 33) */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-30 flex items-center justify-around gap-2">
        {role === 'REQUESTER' && (
          <button
            onClick={() => navigate('/purchase-requests/new')}
            className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition"
          >
            <PlusCircle className="w-4 h-4" />
            + BUAT PERMINTAAN
          </button>
        )}

        {role === 'WAREHOUSE' && (
          <>
            <button
              onClick={() => navigate('/warehouse-check')}
              className="flex-1 py-2 px-2 bg-blue-600 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              CEK STOK
            </button>
            <button
              onClick={() => navigate('/goods-receipts/new')}
              className="flex-1 py-2 px-2 bg-emerald-600 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              TERIMA
            </button>
            <button
              onClick={() => navigate('/goods-issues/new')}
              className="flex-1 py-2 px-2 bg-amber-600 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              KELUARKAN
            </button>
          </>
        )}

        {role === 'PURCHASING' && (
          <>
            <button
              onClick={() => navigate('/purchasing')}
              className="flex-1 py-2 px-2 bg-indigo-600 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition"
            >
              PR BARU
            </button>
            <button
              onClick={() => navigate('/purchasing/quotations')}
              className="flex-1 py-2 px-2 bg-purple-600 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition"
            >
              QUOTATION
            </button>
            <button
              onClick={() => navigate('/purchase-orders/new')}
              className="flex-1 py-2 px-2 bg-amber-600 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition"
            >
              PO
            </button>
          </>
        )}

        {role === 'APPROVER' && (
          <button
            onClick={() => navigate('/approvals')}
            className="flex-1 py-2.5 px-3 bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            PERSETUJUAN PENDING
          </button>
        )}
      </div>

      {/* Main Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-40 flex items-center justify-around px-2 shadow-lg">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition ${
              isActive ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          <Home className="w-5 h-5 mb-0.5" />
          Home
        </NavLink>

        <NavLink
          to="/purchase-requests"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition ${
              isActive ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          <FileText className="w-5 h-5 mb-0.5" />
          PR
        </NavLink>

        <NavLink
          to="/stock"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition ${
              isActive ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          <Boxes className="w-5 h-5 mb-0.5" />
          Stok
        </NavLink>

        <NavLink
          to="/handovers"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition ${
              isActive ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          <CheckCircle2 className="w-5 h-5 mb-0.5" />
          Handover
        </NavLink>

        <NavLink
          to="/dashboard"
          onClick={() => {}}
          className="flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium text-slate-500"
        >
          <User className="w-5 h-5 mb-0.5" />
          Profil
        </NavLink>
      </nav>
    </>
  );
};

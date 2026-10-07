import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';
import { MobileNav } from './MobileNav.js';
import { useOffline } from '../../context/OfflineContext.js';
import { WifiOff, RefreshCw } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isOnline, syncStatus, offlineDraftsCount, syncNow } = useOffline();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Offline Alert Bar */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between sticky top-16 z-20 shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <WifiOff className="w-4 h-4" />
            <span>Mode Offline Aktif — Anda masih dapat membuat Draft PR dan melihat katalog barang yang tersimpan.</span>
          </div>
          <span className="text-[11px] bg-amber-700/50 px-2 py-0.5 rounded">
            {offlineDraftsCount} Draft Lokal
          </span>
        </div>
      )}

      {isOnline && syncStatus === 'SYNCING' && (
        <div className="bg-blue-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 sticky top-16 z-20">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Sedang menyinkronkan data draft lokal ke server...</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
};

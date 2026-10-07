import React, { useState, useEffect } from 'react';
import { Search, Bell, Wifi, WifiOff, RefreshCw, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useOffline } from '../../context/OfflineContext.js';
import { SearchModal } from '../ui/SearchModal.js';
import { api } from '../../services/api.js';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOnline, syncStatus, offlineDraftsCount, syncNow } = useOffline();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              G
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 leading-tight">GOLDEN PROCUREMENT</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">& WAREHOUSE SYSTEM</p>
            </div>
          </div>

          {/* Global Search Bar */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200/80 rounded-lg border border-slate-200 transition md:w-64"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">Cari PR, PO, Barang...</span>
            <kbd className="hidden md:inline ml-auto text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-400">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline / Sync Indicator */}
          <div className="flex items-center">
            {isOnline ? (
              <div
                onClick={syncNow}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition"
                title={offlineDraftsCount > 0 ? `${offlineDraftsCount} draft pending sync` : 'Sistem Online'}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Online</span>
                {offlineDraftsCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] px-1 rounded-full animate-bounce">
                    {offlineDraftsCount}
                  </span>
                )}
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200"
                title="Bekerja dalam Mode Offline. Draft tersimpan lokal."
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
                {offlineDraftsCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1 rounded-full">
                    {offlineDraftsCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative transition"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Notifikasi Alur Kerja
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Tandai sudah dibaca
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs hover:bg-slate-50 transition ${
                          !n.isRead ? 'bg-amber-50/40 font-medium' : ''
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{n.title}</p>
                        <p className="text-slate-600 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Tidak ada notifikasi baru
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Role Info */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-800 leading-none">{user?.name}</div>
              <div className="text-[10px] text-amber-700 font-medium mt-0.5 uppercase tracking-wider">
                {user?.roleName} • {user?.departmentName || 'Semua'}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
              {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
            </div>
            <button
              onClick={logout}
              title="Keluar"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Warehouse,
  ShoppingBag,
  CheckSquare,
  PackageCheck,
  PackageMinus,
  Boxes,
  ScrollText,
  Truck,
  Users,
  Settings,
  ShieldAlert,
  BarChart3,
  CreditCard,
  Building2,
  Tags,
  Clock,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

export const Sidebar: React.FC = () => {
  const { hasRole } = useAuth();

  const sections = [
    {
      title: 'UTAMA',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Status Tracking', path: '/tracking', icon: Clock },
      ],
    },
    {
      title: 'PENGADAAN (PROCUREMENT)',
      items: [
        { label: 'Permintaan Barang', path: '/purchase-requests', icon: FileText },
        { label: 'Cek Gudang', path: '/warehouse-check', icon: Warehouse, roles: ['ADMIN', 'WAREHOUSE'] },
        { label: 'Cek Harga & Penawaran', path: '/purchasing', icon: ShoppingBag, roles: ['ADMIN', 'PURCHASING'] },
        { label: 'Purchase Order', path: '/purchase-orders', icon: FileText, roles: ['ADMIN', 'PURCHASING', 'MANAGEMENT', 'APPROVER'] },
        { label: 'Persetujuan (Approval)', path: '/approvals', icon: CheckSquare, roles: ['ADMIN', 'APPROVER', 'MANAGEMENT'] },
        { label: 'Pembelian Langsung', path: '/direct-purchases', icon: CreditCard, roles: ['ADMIN', 'PURCHASING'] },
      ],
    },
    {
      title: 'GUDANG (WAREHOUSE)',
      items: [
        { label: 'Penerimaan Barang', path: '/goods-receipts', icon: PackageCheck, roles: ['ADMIN', 'WAREHOUSE'] },
        { label: 'Stok Gudang', path: '/stock', icon: Boxes },
        { label: 'Kartu Stok', path: '/stock-card', icon: ScrollText, roles: ['ADMIN', 'WAREHOUSE', 'MANAGEMENT'] },
        { label: 'Pengeluaran Barang', path: '/goods-issues', icon: PackageMinus, roles: ['ADMIN', 'WAREHOUSE'] },
        { label: 'Serah Terima', path: '/handovers', icon: PackageCheck },
      ],
    },
    {
      title: 'MASTER DATA',
      items: [
        { label: 'Barang & Kowi', path: '/master/items', icon: Boxes, roles: ['ADMIN', 'WAREHOUSE', 'PURCHASING'] },
        { label: 'Kategori', path: '/master/categories', icon: Tags, roles: ['ADMIN'] },
        { label: 'Supplier', path: '/master/suppliers', icon: Truck, roles: ['ADMIN', 'PURCHASING'] },
        { label: 'Gudang & Lokasi', path: '/master/warehouses', icon: Building2, roles: ['ADMIN', 'WAREHOUSE'] },
        { label: 'User & Akses', path: '/master/users', icon: Users, roles: ['ADMIN'] },
      ],
    },
    {
      title: 'LAPORAN & SISTEM',
      items: [
        { label: 'Laporan', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'MANAGEMENT', 'PURCHASING', 'WAREHOUSE', 'APPROVER'] },
        { label: 'Audit Trail', path: '/audit-trail', icon: ShieldAlert, roles: ['ADMIN', 'MANAGEMENT'] },
        { label: 'Pengaturan', path: '/settings', icon: Settings, roles: ['ADMIN'] },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {sections.map((sec, secIdx) => {
          // Filter items based on user roles
          const visibleItems = sec.items.filter((item) => {
            if (!item.roles) return true;
            return hasRole(item.roles as any);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={secIdx}>
              <h2 className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {sec.title}
              </h2>
              <div className="space-y-1">
                {visibleItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={idx}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition ${
                          isActive
                            ? 'bg-amber-500 text-white shadow-sm font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

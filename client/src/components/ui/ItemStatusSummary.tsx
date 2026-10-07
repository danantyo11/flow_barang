import React from 'react';
import { StatusBadge } from './StatusBadge.js';

export interface ItemStatusItem {
  count: number;
  label: string;
  color: string;
  code: string;
}

interface Props {
  items?: any[];
  prStatus?: string;
  summary?: ItemStatusItem[];
  className?: string;
}

export function computeItemLiveStatus(item: any, prStatus?: string): {
  code: string;
  label: string;
  color: string;
} {
  // If backend already attached liveStatus, use it
  if (item?.liveStatus?.code) {
    return item.liveStatus;
  }

  const activePoItem = item?.poItems?.find(
    (pi: any) => pi.purchaseOrder && !['CANCELLED', 'REJECTED'].includes(pi.purchaseOrder.status)
  );

  if (activePoItem?.purchaseOrder) {
    const poStatus = activePoItem.purchaseOrder.status;
    if (poStatus === 'WAITING_APPROVAL') {
      return { code: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'amber' };
    }
    if (poStatus === 'DRAFT') {
      return { code: 'DRAFT_PO', label: 'Draft PO', color: 'slate' };
    }
    if (['APPROVED', 'SENT'].includes(poStatus)) {
      return { code: 'ORDERED', label: 'Ordered', color: 'purple' };
    }
    if (poStatus === 'PARTIALLY_RECEIVED') {
      return { code: 'PARTIALLY_RECEIVED', label: 'Sebagian Diterima', color: 'cyan' };
    }
    if (poStatus === 'FULLY_RECEIVED') {
      return { code: 'RECEIVED', label: 'Diterima Gudang', color: 'emerald' };
    }
    if (['CLOSED', 'COMPLETED'].includes(poStatus)) {
      return { code: 'COMPLETED', label: 'Selesai', color: 'emerald' };
    }
  }

  if (item?.status === 'ORDERED') {
    if (prStatus === 'WAITING_APPROVAL') {
      return { code: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'amber' };
    }
    return { code: 'ORDERED', label: 'Ordered', color: 'purple' };
  }

  if (prStatus === 'WAITING_APPROVAL') {
    return { code: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'amber' };
  }

  if (item?.status === 'ALLOCATED') {
    return { code: 'ALLOCATED', label: 'Alokasi Stok', color: 'emerald' };
  }
  if (item?.status === 'PURCHASING') {
    return { code: 'PURCHASING', label: 'Siap PO', color: 'blue' };
  }
  if (item?.status === 'COMPLETED') {
    return { code: 'COMPLETED', label: 'Selesai', color: 'emerald' };
  }
  if (item?.status === 'PENDING') {
    if (prStatus === 'WAITING_WAREHOUSE_CHECK') {
      return { code: 'WAITING_CHECK', label: 'Cek Gudang', color: 'amber' };
    }
    return { code: 'PENDING', label: 'Pending', color: 'slate' };
  }

  return { code: item?.status || 'PENDING', label: item?.status || 'Pending', color: 'slate' };
}

export function computePRItemStatusSummary(items: any[], prStatus?: string): ItemStatusItem[] {
  if (!items || items.length === 0) return [];
  const counts: Record<string, ItemStatusItem> = {};

  items.forEach((item) => {
    const live = computeItemLiveStatus(item, prStatus);
    if (!counts[live.code]) {
      counts[live.code] = { count: 0, label: live.label, color: live.color, code: live.code };
    }
    counts[live.code].count += 1;
  });

  return Object.values(counts);
}

const colorMap: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const ItemStatusSummary: React.FC<Props> = ({
  items,
  prStatus,
  summary: propSummary,
  className = '',
}) => {
  const summaryList =
    propSummary && propSummary.length > 0
      ? propSummary
      : items && items.length > 0
      ? computePRItemStatusSummary(items, prStatus)
      : null;

  if (!summaryList || summaryList.length === 0) {
    return <StatusBadge status={prStatus || 'PENDING'} />;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {summaryList.map((st) => {
        const style = colorMap[st.color] || colorMap.slate;
        return (
          <span
            key={st.code}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${style}`}
          >
            <span>{st.count}</span>
            <span>{st.label}</span>
          </span>
        );
      })}
    </div>
  );
};

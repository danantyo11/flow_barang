import React from 'react';

interface Props {
  status: string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const getBadgeStyle = (st: string) => {
    switch (st.toUpperCase()) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SUBMITTED':
      case 'WAITING_WAREHOUSE_CHECK':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'STOCK_ISSUE':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'PARTIAL_STOCK':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PROCUREMENT':
      case 'WAITING_PRICE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'WAITING_PO':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'WAITING_APPROVAL':
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'APPROVED':
      case 'POSTED':
      case 'PASSED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'REVISION_REQUIRED':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'SENT':
      case 'ORDERED':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'PARTIALLY_RECEIVED':
      case 'QC_PARTIAL':
      case 'PARTIAL':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'FULLY_RECEIVED':
      case 'RECEIVED':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'WAITING_HANDOVER':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'COMPLETED':
        return 'bg-green-50 text-green-800 border-green-300 font-medium';
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-300 animate-pulse font-medium';
      case 'LOW_STOCK':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'NORMAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatText = (st: string) => {
    return st.replace(/_/g, ' ');
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyle(
        status
      )}`}
    >
      {formatText(status)}
    </span>
  );
};

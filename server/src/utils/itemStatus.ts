export function computeItemLiveStatus(item: any, prStatus?: string): {
  code: string;
  label: string;
  color: string;
} {
  // 1. Check if item has PO items
  const activePoItem = item.poItems?.find(
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

  // 2. If item is marked ORDERED (e.g. multi-PR consolidation where PO is active)
  if (item.status === 'ORDERED') {
    if (prStatus === 'WAITING_APPROVAL') {
      return { code: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'amber' };
    }
    return { code: 'ORDERED', label: 'Ordered', color: 'purple' };
  }

  // 3. If PR is WAITING_APPROVAL
  if (prStatus === 'WAITING_APPROVAL') {
    return { code: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'amber' };
  }

  // 4. Standard item status
  if (item.status === 'ALLOCATED') {
    return { code: 'ALLOCATED', label: 'Alokasi Stok', color: 'emerald' };
  }
  if (item.status === 'PURCHASING') {
    return { code: 'PURCHASING', label: 'Siap PO', color: 'blue' };
  }
  if (item.status === 'COMPLETED') {
    return { code: 'COMPLETED', label: 'Selesai', color: 'emerald' };
  }
  if (item.status === 'PENDING') {
    if (prStatus === 'WAITING_WAREHOUSE_CHECK') {
      return { code: 'WAITING_CHECK', label: 'Cek Gudang', color: 'amber' };
    }
    return { code: 'PENDING', label: 'Pending', color: 'slate' };
  }

  return { code: item.status || 'PENDING', label: item.status || 'Pending', color: 'slate' };
}

export function computePRItemStatusSummary(items: any[], prStatus?: string) {
  if (!items || items.length === 0) return [];
  const counts: Record<string, { count: number; label: string; color: string; code: string }> = {};

  items.forEach((item) => {
    const live = computeItemLiveStatus(item, prStatus);
    if (!counts[live.code]) {
      counts[live.code] = { count: 0, label: live.label, color: live.color, code: live.code };
    }
    counts[live.code].count += 1;
  });

  return Object.values(counts);
}

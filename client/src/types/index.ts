export type UserRole =
  | 'ADMIN'
  | 'REQUESTER'
  | 'WAREHOUSE'
  | 'PURCHASING'
  | 'APPROVER'
  | 'MANAGEMENT';

export interface User {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  departmentId?: string | null;
  departmentName?: string | null;
  roleName: UserRole;
  position?: string | null;
}

export interface Item {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  categoryId: string;
  subcategory?: string | null;
  subcategoryId?: string | null;
  unit: string;
  unitCode: string;
  unitId: string;
  specification?: string | null;
  brand?: string | null;
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  criticalStock: number;
  isCritical: boolean;
  defaultWarehouse?: string | null;
  defaultWarehouseId?: string | null;
  isActive: boolean;
  totalStock: number;
  stockStatus: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL';
}

export interface PurchaseRequestItem {
  id: string;
  prId: string;
  itemId: string;
  specification?: string | null;
  requestedQty: number;
  unitId: string;
  estimatedPrice: number;
  availableStock: number;
  allocatedQty: number;
  purchaseQty: number;
  status: string;
  notes?: string | null;
  item?: Item;
  unit?: { code: string; name: string };
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  requestDate: string;
  requesterId: string;
  departmentId: string;
  requiredDate?: string | null;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  purpose?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  requester?: { id: string; name: string; employeeNumber: string; email: string };
  department?: { id: string; departmentName: string; departmentCode: string };
  items: PurchaseRequestItem[];
  quotations?: any[];
  purchaseOrders?: any[];
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  prItemId?: string | null;
  itemId: string;
  specification?: string | null;
  quantity: number;
  unitId: string;
  unitPrice: number;
  discount: number;
  taxPercent: number;
  subtotal: number;
  receivedQty: number;
  remainingQty: number;
  item?: Item;
  unit?: { code: string; name: string };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  prId?: string | null;
  supplierId: string;
  poDate: string;
  deliveryDate?: string | null;
  paymentTerms?: string | null;
  shippingTerms?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  status: string;
  purchaseType: 'VENDOR' | 'DIRECT';
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  supplier?: { id: string; supplierCode: string; supplierName: string; phone?: string };
  items: PurchaseOrderItem[];
  approvalInstance?: any;
}

export interface Supplier {
  id: string;
  supplierCode: string;
  supplierName: string;
  address?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  paymentTerms?: string | null;
  leadTimeDays: number;
  status: string;
}

export interface Warehouse {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  address?: string | null;
  locations?: WarehouseLocation[];
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  locationName: string;
  rack?: string | null;
  bin?: string | null;
}

export interface StockLedgerEntry {
  id: string;
  date: string;
  transactionNumber: string;
  type: string;
  referenceType: string;
  referenceId: string;
  warehouse: string;
  location: string;
  qtyIn: number;
  qtyOut: number;
  balanceBefore: number;
  balanceAfter: number;
  unitCost?: number | null;
  notes?: string | null;
}

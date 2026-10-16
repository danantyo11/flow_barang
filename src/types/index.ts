export enum RoleCode {
  SYST000 = 'SYST000',
  REQUESTOR = 'REQUESTOR',
  GUDANG = 'GUDANG',
  SUPERVISOR = 'SUPERVISOR',
  KEPALA_BAGIAN = 'KEPALA_BAGIAN',
  ASISTEN_MANAGER = 'ASISTEN_MANAGER',
  MANAGER = 'MANAGER',
  DIREKTUR = 'DIREKTUR',
  DIREKTUR_UTAMA = 'DIREKTUR_UTAMA',
  PURCHASING = 'PURCHASING'
}

export enum PRStatus {
  DRAFT = 'DRAFT',
  SUBMITTED_TO_GUDANG = 'SUBMITTED_TO_GUDANG',
  FULFILLED_BY_STOCK = 'FULFILLED_BY_STOCK',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PO_PROCESS = 'IN_PO_PROCESS',
  COMPLETED = 'COMPLETED'
}

export enum POStatus {
  DRAFT_PO = 'DRAFT_PO',
  WAITING_PO_APPROVAL = 'WAITING_PO_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RELEASED_TO_VENDOR = 'RELEASED_TO_VENDOR',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role_id: number;
  role?: Role;
  department_id: number;
  is_active: boolean;
}

export interface Role {
  id: number;
  role_code: RoleCode;
  role_name: string;
  level: number;
  can_approve_pr: boolean;
  can_approve_po: boolean;
}

export interface ApprovalLimit {
  id: number;
  role_id: number;
  role?: Role;
  min_amount: number;
  max_amount: number;
  is_active: boolean;
  updated_by?: number;
}

export enum GoodsReceiptStatus {
  WAITING_RECEIPT = 'WAITING_RECEIPT',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED_COMPLETED = 'RECEIVED_COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface GoodsReceipt {
  id: number;
  receipt_number: string;
  po_id: number;
  warehouse_user_id?: number;
  vendor_delivery_note_number?: string;
  received_date?: string;
  status: GoodsReceiptStatus;
  receiving_notes?: string;
  items?: GoodsReceiptItem[];
  created_at?: string;
  updated_at?: string;
}

export interface GoodsReceiptItem {
  id: number;
  goods_receipt_id: number;
  po_item_id: number;
  qty_ordered: number;
  qty_received: number;
  qty_accepted: number;
  qty_rejected: number;
  warehouse_bin_location?: string;
  item_condition_notes?: string;
}


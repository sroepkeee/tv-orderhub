export interface PurchaseRequest {
  id: string;
  purchase_order_number: string;
  requested_by: string;
  request_type: 'normal' | 'urgent' | 'auto_generated';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  company?: 'IMPLY TEC' | 'IMPLY RENTAL' | 'IMPLY FILIAL';
  notes?: string;
  rejection_reason?: string;
  total_estimated_value: number;
  expected_delivery_date?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestItem {
  id: string;
  purchase_request_id: string;
  order_item_id?: string;
  item_code: string;
  item_description: string;
  requested_quantity: number;
  approved_quantity?: number;
  unit: string;
  unit_price?: number;
  total_price?: number;
  warehouse: string;
  item_status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'received';
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemPurchaseHistory {
  id: string;
  item_code: string;
  purchase_date: string;
  quantity: number;
  unit_price?: number;
  supplier?: string;
  purchase_order_number?: string;
  notes?: string;
  created_at: string;
}

export interface ItemConsumptionMetrics {
  id: string;
  item_code: string;
  consumption_30_days: number;
  consumption_60_days: number;
  consumption_90_days: number;
  average_daily_consumption: number;
  last_calculated_at: string;
}

export interface ItemStockInfo {
  id: string;
  item_code: string;
  warehouse?: string;
  current_stock_quantity: number;
  minimum_stock_level?: number;
  maximum_stock_level?: number;
  last_purchase_date?: string;
  last_purchase_price?: number;
  last_purchase_quantity?: number;
  last_updated: string;
  updated_by?: string;
}

export interface ItemCostAllocation {
  id: string;
  purchase_request_item_id: string;
  business_unit: 'Autoatendimento' | 'Bowling' | 'Painéis' | 'Controle de Acessos';
  accounting_item?: string;
  project?: string;
  cost_center: string;
  warehouse: string;
  allocation_percentage: number;
  allocated_quantity?: number;
  allocated_value?: number;
  notes?: string;
  created_at: string;
}

export interface EnrichedPurchaseItem extends PurchaseRequestItem {
  current_stock?: number;
  purchase_history?: ItemPurchaseHistory[];
  consumption_metrics?: ItemConsumptionMetrics;
  criticality?: 'high' | 'medium' | 'low';
  cost_allocations?: ItemCostAllocation[];
}

export interface PurchaseMetrics {
  total_active_requests: number;
  items_awaiting_request: number;
  pending_approvals: number;
  approved_this_month: number;
  total_estimated_value: number;
}

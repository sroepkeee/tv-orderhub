export interface ProductionItem {
  id: string;
  orderId: string;
  orderNumber: string;
  itemCode: string;
  itemDescription: string;
  unit: string;
  requestedQuantity: number;
  deliveredQuantity: number;
  warehouse: string;
  deliveryDate: string;
  item_status: 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed';
  item_source_type?: 'in_stock' | 'production' | 'out_of_stock';
  sla_days?: number;
  sla_deadline?: string;
  current_phase?: string;
  created_at: string;
  customerName?: string;
  orderStatus?: string;
}

export interface ProductionStats {
  total: number;
  awaiting_production: number;
  pending: number;
  purchase_required: number;
  completed: number;
  in_stock: number;
  critical: number; // Prazo < 3 dias
}

export interface ProductionFilters {
  orderNumber?: string;
  itemStatus?: 'all' | 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed';
  warehouse?: string;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
}

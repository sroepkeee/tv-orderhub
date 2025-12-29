// Tipos para o Sistema de Controle de Remessas para Técnicos

export interface Technician {
  id: string;
  organization_id?: string;
  user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  document?: string;
  city?: string;
  state?: string;
  address?: string;
  zip_code?: string;
  specialty?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type DispatchStatus = 'dispatched' | 'partial_return' | 'fully_returned' | 'overdue' | 'cancelled';

export interface TechnicianDispatch {
  id: string;
  organization_id?: string;
  order_id: string;
  technician_id: string;
  origin_warehouse: string;
  dispatch_date: string;
  expected_return_date?: string;
  status: DispatchStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joins
  technician?: Technician;
  order?: {
    id: string;
    order_number: string;
    customer_name: string;
    order_type: string;
  };
  items?: TechnicianDispatchItem[];
  items_count?: number;
  items_pending?: number;
}

export type ItemReturnStatus = 'pending' | 'partial' | 'returned' | 'lost' | 'consumed';

export interface TechnicianDispatchItem {
  id: string;
  dispatch_id: string;
  order_item_id?: string;
  item_code: string;
  item_description: string;
  unit: string;
  quantity_sent: number;
  quantity_returned: number;
  return_status: ItemReturnStatus;
  returned_at?: string;
  returned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type ReturnRequestStatus = 'pending' | 'approved' | 'scheduled' | 'in_transit' | 'received' | 'rejected' | 'cancelled';
export type DestinationType = 'warehouse' | 'technician';

export interface VolumeDetail {
  quantity: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  packaging_type: string;
}

export interface ReturnRequest {
  id: string;
  organization_id?: string;
  dispatch_id: string;
  technician_id: string;
  destination_warehouse: string;
  destination_type: DestinationType;
  destination_technician_id?: string;
  pickup_address?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_zip_code?: string;
  pickup_contact?: string;
  pickup_phone?: string;
  status: ReturnRequestStatus;
  carrier_id?: string;
  tracking_code?: string;
  freight_value?: number;
  total_weight_kg?: number;
  total_volumes?: number;
  volume_details?: VolumeDetail[];
  photo_urls?: string[];
  requested_by?: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  scheduled_pickup_date?: string;
  received_by?: string;
  received_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joins
  technician?: Technician;
  dispatch?: TechnicianDispatch;
  carrier?: { id: string; name: string };
  destination_technician?: Technician;
  items?: ReturnRequestItem[];
}

export type ItemCondition = 'good' | 'damaged' | 'for_repair' | 'for_disposal';

export interface ReturnRequestItem {
  id: string;
  return_request_id: string;
  dispatch_item_id: string;
  quantity_returning: number;
  condition: ItemCondition;
  notes?: string;
  created_at: string;
  // Join
  dispatch_item?: TechnicianDispatchItem;
}

export interface DispatchMetrics {
  total_dispatches: number;
  total_items_sent: number;
  total_items_pending: number;
  total_items_returned: number;
  overdue_dispatches: number;
  pending_return_requests: number;
}

// Labels para exibição
export const dispatchStatusLabels: Record<DispatchStatus, string> = {
  dispatched: 'Enviado',
  partial_return: 'Retorno Parcial',
  fully_returned: 'Retornado',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
};

export const itemReturnStatusLabels: Record<ItemReturnStatus, string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  returned: 'Retornado',
  lost: 'Perdido',
  consumed: 'Consumido',
};

export const returnRequestStatusLabels: Record<ReturnRequestStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  scheduled: 'Coleta Agendada',
  in_transit: 'Em Trânsito',
  received: 'Recebido',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

export const itemConditionLabels: Record<ItemCondition, string> = {
  good: 'Bom Estado',
  damaged: 'Danificado',
  for_repair: 'Para Reparo',
  for_disposal: 'Para Descarte',
};

// Cores para badges
export const dispatchStatusColors: Record<DispatchStatus, string> = {
  dispatched: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  partial_return: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  fully_returned: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};

export const returnRequestStatusColors: Record<ReturnRequestStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  scheduled: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  in_transit: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};

export const itemConditionColors: Record<ItemCondition, string> = {
  good: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  damaged: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  for_repair: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  for_disposal: 'bg-red-500/10 text-red-500 border-red-500/20',
};

// Destinos de armazém disponíveis
export const WAREHOUSE_DESTINATIONS = [
  { id: 'imply_rs', name: 'IMPLY TEC (RS)', city: 'Santa Cruz do Sul', state: 'RS' },
  { id: 'imply_sp', name: 'IMPLY SP', city: 'São Paulo', state: 'SP' },
] as const;

// Tipos de embalagem
export const PACKAGING_TYPES = [
  { value: 'caixa_papelao', label: 'Caixa de Papelão' },
  { value: 'caixa_madeira', label: 'Caixa de Madeira' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'envelope', label: 'Envelope' },
  { value: 'saco_plastico', label: 'Saco Plástico' },
  { value: 'outro', label: 'Outro' },
] as const;

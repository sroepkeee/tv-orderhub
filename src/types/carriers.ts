export interface Carrier {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  quote_email?: string;
  collection_email?: string;
  whatsapp?: string;
  phone?: string;
  contact_person?: string;
  contact_position?: string;
  additional_contacts: CarrierContact[];
  service_states: string[];
  coverage_notes?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CarrierContact {
  name: string;
  phone: string;
  role: string;
}

export interface FreightQuote {
  id: string;
  order_id: string;
  carrier_id: string;
  status: 'pending' | 'sent' | 'responded' | 'accepted' | 'rejected' | 'expired';
  quote_request_data: QuoteRequestData;
  requested_at: string;
  sent_at?: string;
  response_received_at?: string;
  expires_at?: string;
  n8n_conversation_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  carrier?: Carrier;
  responses?: FreightQuoteResponse[];
}

export interface QuoteRequestData {
  sender: {
    cnpj: string;
    company_name: string;
    contact_phone: string;
    address: string;
  };
  recipient: {
    name: string;
    city: string;
    state: string;
    address: string;
  };
  cargo: {
    product_description: string;
    packaging: string;
    total_weight_kg: number;
    dimensions: {
      length_m: number;
      width_m: number;
      height_m: number;
    };
    volumes: number;
  };
  freight_payer: 'sender' | 'recipient';
  freight_type: 'CIF' | 'FOB';
  declared_value: number;
  requires_insurance: boolean;
  special_requirements?: string;
}

export interface FreightQuoteResponse {
  id: string;
  quote_id: string;
  freight_value?: number;
  delivery_time_days?: number;
  response_text: string;
  additional_info: Record<string, any>;
  responded_by?: string;
  received_at: string;
  is_selected: boolean;
  created_at: string;
}

export interface CarrierConversation {
  id: string;
  order_id: string | null;
  carrier_id: string;
  quote_id?: string;
  conversation_type: 'quote_request' | 'follow_up' | 'negotiation' | 'general';
  message_direction: 'outbound' | 'inbound';
  message_content: string;
  message_metadata: Record<string, any>;
  contact_type?: 'carrier' | 'customer' | 'technician' | 'supplier';
  is_group_message?: boolean;
  group_id?: string;
  group_name?: string;
  has_media?: boolean;
  media_type?: 'image' | 'audio' | 'document' | 'video' | 'sticker';
  compliance_flags?: Record<string, any>;
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  n8n_message_id?: string;
  created_by?: string;
  created_at: string;
  carrier?: Carrier;
  media?: WhatsAppMedia[];
}

export interface WhatsAppMedia {
  id: string;
  conversation_id: string;
  media_type: 'image' | 'audio' | 'document' | 'video' | 'sticker';
  mime_type?: string;
  file_name?: string;
  file_size_bytes?: number;
  base64_data?: string;
  storage_path?: string;
  thumbnail_base64?: string;
  duration_seconds?: number;
  caption?: string;
  media_key?: string;
  direct_path?: string;
  file_sha256?: string;
  ai_analysis?: {
    tipo?: string;
    detalhes?: string;
    relevante_para_pedido?: boolean;
    detectou_problema?: boolean;
    resumo?: string;
  };
  compliance_check?: {
    has_violations?: boolean;
    highest_risk?: string;
    flags?: ComplianceFlag[];
    requires_human_review?: boolean;
  };
  created_at: string;
  updated_at?: string;
}

export interface ComplianceFlag {
  rule_id: string;
  policy: string;
  keyword_matched: string;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  action: 'log' | 'warn' | 'block' | 'escalate';
}

export interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instance: string;
}

export interface WhatsAppAuthorization {
  id: string;
  user_id: string;
  is_active: boolean;
  authorized_at: string;
  authorized_by?: string;
}

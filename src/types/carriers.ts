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
  order_id: string;
  carrier_id: string;
  quote_id?: string;
  conversation_type: 'quote_request' | 'follow_up' | 'negotiation' | 'general';
  message_direction: 'outbound' | 'inbound';
  message_content: string;
  message_metadata: Record<string, any>;
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  n8n_message_id?: string;
  created_by?: string;
  created_at: string;
  carrier?: Carrier;
}

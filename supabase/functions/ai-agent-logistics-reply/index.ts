import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogisticsReplyRequest {
  message: string;
  from_phone: string;
  carrier_id?: string;
  customer_id?: string;
  conversation_id?: string;
  contact_type?: string; // 'carrier' | 'customer'
}

interface OrderContext {
  order: any;
  items: any[];
  volumes: any[];
  freightQuotes: any[];
  trackingEvents: any[];
  occurrences: any[];
  slaStatus: {
    status: string;
    days_remaining: number;
    is_breached: boolean;
  };
  source: string;
}

// ============= CHANGE REQUEST DETECTION =============
type ChangeRequestType = 
  | 'delivery_address'
  | 'delivery_date'
  | 'add_item'
  | 'remove_item'
  | 'change_quantity'
  | 'cancel_order'
  | 'change_contact'
  | 'other';

interface DetectedChange {
  type: ChangeRequestType;
  confidence: number;
  extractedValue?: string;
}

const changePatterns: Record<ChangeRequestType, RegExp[]> = {
  delivery_address: [
    /mudar?\s*(o)?\s*endere[çc]o/i,
    /alterar?\s*(o)?\s*endere[çc]o/i,
    /trocar?\s*(o)?\s*endere[çc]o/i,
    /entregar?\s*(em)?\s*outro\s*(lugar|endere[çc]o)/i,
    /endere[çc]o\s*(est[aá]|t[aá])\s*errado/i,
    /mand[ae]r?\s*(pra|para)\s*outro\s*(lugar|endere[çc]o)/i,
    /novo\s*endere[çc]o/i,
  ],
  delivery_date: [
    /mudar?\s*(a)?\s*data/i,
    /alterar?\s*(a)?\s*data/i,
    /antecipar?\s*(a)?\s*(entrega|data)/i,
    /adiar?\s*(a)?\s*(entrega|data)/i,
    /preciso?\s*(para|at[ée])\s*(o)?\s*dia/i,
    /mudar?\s*(o)?\s*prazo/i,
    /postergar?/i,
    /reprogramar?/i,
    /reagendar?/i,
    /nova\s*data/i,
  ],
  add_item: [
    /adicionar?\s*(um|mais)?\s*item/i,
    /incluir?\s*(um|mais)?\s*item/i,
    /acrescentar?\s*(um|mais)?\s*item/i,
    /colocar?\s*mais/i,
    /quero?\s*mais/i,
  ],
  remove_item: [
    /remover?\s*(o|um)?\s*item/i,
    /tirar?\s*(o|um)?\s*item/i,
    /excluir?\s*(o|um)?\s*item/i,
    /retirar?\s*(o|um)?\s*item/i,
    /n[ãa]o\s*quero\s*(mais)?\s*(o|esse|este)/i,
  ],
  change_quantity: [
    /mudar?\s*(a)?\s*quantidade/i,
    /alterar?\s*(a)?\s*quantidade/i,
    /trocar?\s*(a)?\s*quantidade/i,
    /aumentar?\s*(a)?\s*quantidade/i,
    /diminuir?\s*(a)?\s*quantidade/i,
    /menos\s*unidades/i,
    /mais\s*unidades/i,
  ],
  cancel_order: [
    /cancelar?\s*(o)?\s*pedido/i,
    /desistir?\s*(do)?\s*pedido/i,
    /n[ãa]o\s*quero\s*mais\s*(o\s*pedido)?/i,
    /anular?\s*(o)?\s*pedido/i,
    /estornar?/i,
    /devolver?\s*tudo/i,
  ],
  change_contact: [
    /mudar?\s*(o)?\s*(telefone|contato|celular)/i,
    /alterar?\s*(o)?\s*(telefone|contato|celular)/i,
    /trocar?\s*(o)?\s*(telefone|contato|celular)/i,
    /novo\s*(telefone|contato|celular)/i,
    /ligar?\s*(para|pra)\s*outro\s*n[uú]mero/i,
  ],
  other: [
    /quero?\s*(fazer)?\s*(uma)?\s*altera[çc][ãa]o/i,
    /preciso?\s*mudar/i,
    /preciso?\s*alterar/i,
    /d[aá]\s*(pra|para)\s*mudar/i,
    /d[aá]\s*(pra|para)\s*alterar/i,
    /como\s*(fa[çc]o\s*para|posso)\s*mudar/i,
    /como\s*(fa[çc]o\s*para|posso)\s*alterar/i,
  ],
};

const changeTypeLabels: Record<ChangeRequestType, string> = {
  delivery_address: 'alteração de endereço de entrega',
  delivery_date: 'alteração de data de entrega',
  add_item: 'adição de item ao pedido',
  remove_item: 'remoção de item do pedido',
  change_quantity: 'alteração de quantidade',
  cancel_order: 'cancelamento de pedido',
  change_contact: 'alteração de contato',
  other: 'outra alteração',
};

function detectChangeRequest(message: string): DetectedChange | null {
  for (const [type, patterns] of Object.entries(changePatterns) as [ChangeRequestType, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        const extractedValue = extractRequestedValue(message, type);
        return {
          type,
          confidence: type === 'other' ? 0.6 : 0.85,
          extractedValue,
        };
      }
    }
  }
  return null;
}

function extractRequestedValue(message: string, type: ChangeRequestType): string | undefined {
  switch (type) {
    case 'delivery_date': {
      const datePatterns = [
        /dia\s*(\d{1,2})\s*(de)?\s*(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)?/i,
        /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
        /sexta|sábado|domingo|segunda|terça|quarta|quinta/i,
        /semana\s*que\s*vem/i,
        /próxima\s*semana/i,
      ];
      for (const pattern of datePatterns) {
        const match = message.match(pattern);
        if (match) return match[0];
      }
      break;
    }
    case 'delivery_address': {
      const afterKeyword = message.match(/(?:para|pra|no|na|em)\s*:?\s*(.{10,100})/i);
      if (afterKeyword) return afterKeyword[1].trim();
      break;
    }
    case 'change_quantity': {
      const quantityMatch = message.match(/(\d+)\s*(unidades?|itens?|peças?)/i);
      if (quantityMatch) return quantityMatch[0];
      break;
    }
  }
  return undefined;
}

// ============= LGPD FILTER =============
const BLOCKED_FIELDS_FOR_CUSTOMERS = [
  'user_id', 'created_by', 'updated_by',
  'executive_name', 'executive_id', 'sales_rep',
  'cost_center', 'account_item', 'accounting_item',
  'business_area', 'business_unit', 'rateio_project_code',
  'operation_code', 'product_line',
  'unit_price', 'total_price', 'discount_percent', 'discount_value',
  'ipi_percent', 'icms_percent', 'margin', 'profit_margin',
  'purchase_action_started_by', 'production_released_by',
  'internal_notes', 'admin_notes', 'supplier_notes',
  'totvs_internal_code', 'erp_sync_status',
];

const ALLOWED_FIELDS_FOR_CUSTOMERS = [
  'order_number', 'totvs_order_number', 'status',
  'delivery_date', 'shipping_date', 'delivery_address',
  'customer_name', 'customer_document',
  'carrier_name', 'tracking_code', 'freight_type',
  'package_volumes', 'package_weight_kg',
  'item_code', 'item_description', 'requested_quantity', 'delivered_quantity',
];

function filterOrderForCustomer(order: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(order)) {
    if (BLOCKED_FIELDS_FOR_CUSTOMERS.includes(key)) continue;
    if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cost') || 
        key.toLowerCase().includes('margin') || key.toLowerCase().includes('profit')) continue;
    if (key === 'order_items' && Array.isArray(value)) {
      filtered[key] = value.map(filterOrderItemForCustomer);
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}

function filterOrderItemForCustomer(item: Record<string, any>): Record<string, any> {
  return {
    item_code: item.item_code,
    item_description: item.item_description,
    requested_quantity: item.requested_quantity,
    delivered_quantity: item.delivered_quantity,
    item_status: item.item_status,
  };
}

function containsSensitiveDataRequest(message: string): boolean {
  const sensitivePatterns = [
    /quanto\s*(custa|custou|paguei|pago)/i,
    /pre[çc]o\s*(unit[aá]rio|total)/i,
    /valor\s*(unit[aá]rio|total|do\s*pedido)/i,
    /margem/i,
    /desconto/i,
    /lucro/i,
    /custo/i,
    /tabela\s*de\s*pre[çc]os/i,
    /nome\s*do\s*vendedor/i,
    /quem\s*vendeu/i,
    /comiss[ãa]o/i,
  ];
  return sensitivePatterns.some(p => p.test(message));
}

function getSensitiveDataBlockedResponse(): string {
  return `Por questões de segurança e privacidade, informações financeiras e dados estratégicos não podem ser compartilhados por este canal. 🔒

Para consultar valores, descontos ou informações detalhadas do seu pedido, por favor:
• Entre em contato com seu executivo de vendas
• Acesse o portal do cliente
• Ligue para nossa central: (XX) XXXX-XXXX

Posso ajudar com outras informações do seu pedido, como status, prazo de entrega ou rastreamento! 📦`;
}

// ============= UTILITY FUNCTIONS =============
function extractOrderNumber(message: string): string | null {
  const patterns = [
    /pedido\s*#?\s*(\d{4,})/i,
    /ordem\s*#?\s*(\d{4,})/i,
    /os\s*#?\s*(\d{4,})/i,
    /#(\d{4,})/,
    /número\s*(\d{4,})/i,
    /nº\s*(\d{4,})/i,
    /n\.\s*(\d{4,})/i,
    /(\d{5,})/,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function calculateSlaStatus(order: any): { status: string; days_remaining: number; is_breached: boolean } {
  if (!order.sla_deadline && !order.delivery_date) {
    return { status: 'unknown', days_remaining: 0, is_breached: false };
  }
  const deadline = order.sla_deadline || order.delivery_date;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { status: 'breached', days_remaining: diffDays, is_breached: true };
  } else if (diffDays <= 2) {
    return { status: 'warning', days_remaining: diffDays, is_breached: false };
  }
  return { status: 'within', days_remaining: diffDays, is_breached: false };
}

function detectNegativeSentiment(message: string): boolean {
  const negativePatterns = [
    /absurdo/i, /ridículo/i, /vergonha/i, /péssimo/i,
    /nunca mais/i, /reclamar/i, /procon/i, /advogado/i,
    /processo/i, /inaceitável/i, /indignado/i, /revoltado/i,
    /raiva/i, /ódio/i, /porcaria/i, /lixo/i,
    /mentira/i, /enganar/i, /roubo/i, /fraude/i
  ];
  return negativePatterns.some(p => p.test(message));
}

function containsFinancialMention(message: string): boolean {
  const financialPatterns = [
    /reembolso/i, /estorno/i, /dinheiro/i, /devolver/i,
    /ressarcimento/i, /indenização/i, /prejuízo/i, /perda/i
  ];
  return financialPatterns.some(p => p.test(message));
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Pendente',
    'in_transit': 'Em Trânsito',
    'delivered': 'Entregue',
    'collected': 'Coletado',
    'awaiting_pickup': 'Aguardando Coleta',
    'pickup_scheduled': 'Coleta Agendada',
    'in_expedition': 'Em Expedição',
    'released_for_shipping': 'Liberado para Envio',
    'ready_for_shipping': 'Pronto para Envio',
    'invoice_issued': 'Nota Fiscal Emitida',
    'separation_started': 'Separação Iniciada',
    'in_production': 'Em Produção',
    'production_completed': 'Produção Concluída',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    'delayed': 'Atrasado',
  };
  return statusMap[status] || status;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Não definida';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

// ============= MANAGER NOTIFICATION =============
async function notifyManagersAboutChangeRequest(
  supabase: any, 
  request: any, 
  order: any
): Promise<void> {
  try {
    // Buscar gestores de logística ou admin
    const { data: managers } = await supabase
      .from('phase_managers')
      .select('user_id, whatsapp, profiles!inner(full_name)')
      .in('phase_key', ['logistics', 'completion'])
      .eq('is_active', true)
      .limit(3);

    if (!managers || managers.length === 0) {
      console.log('⚠️ No managers found for notification');
      return;
    }

    const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!instance?.instance_key) {
      console.log('⚠️ No connected WhatsApp instance');
      return;
    }

    const changeLabel = changeTypeLabels[request.change_type as ChangeRequestType] || 'solicitação';
    const message = `🔔 *Nova Solicitação de Alteração*

📦 Pedido: *#${order.order_number}*
👤 Cliente: ${request.requested_by_name || 'Não identificado'}
📱 Telefone: ${request.requested_by_phone}

📝 *Tipo:* ${changeLabel}
💬 "${request.description.substring(0, 150)}${request.description.length > 150 ? '...' : ''}"

⏳ Aguardando sua aprovação no painel.`;

    let normalizedUrl = megaApiUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    for (const manager of managers) {
      if (!manager.whatsapp) continue;

      let formattedPhone = manager.whatsapp.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
      const sendUrl = `${normalizedUrl}${endpoint}`;

      try {
        await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': megaApiToken,
          },
          body: JSON.stringify({
            messageData: {
              to: formattedPhone,
              text: message,
              linkPreview: false,
            }
          }),
        });
        console.log(`✅ Manager notified: ${manager.profiles?.full_name}`);
      } catch (err) {
        console.error(`❌ Failed to notify manager: ${err}`);
      }
    }
  } catch (error) {
    console.error('❌ Error notifying managers:', error);
  }
}

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { 
      message, 
      from_phone, 
      carrier_id, 
      customer_id, 
      conversation_id, 
      contact_type = 'customer' 
    }: LogisticsReplyRequest = payload;
    
    console.log('📦 Logistics Reply - Message:', message, 'From:', from_phone, 'Type:', contact_type, 'Customer:', customer_id);

    // 🛡️ VALIDATION: Ensure message is a valid string
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error('❌ Invalid or empty message received:', JSON.stringify(payload));
      return new Response(JSON.stringify({
        success: false,
        error: 'Message is required and must be a non-empty string',
        receivedPayload: Object.keys(payload),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0. CHECK FOR SENSITIVE DATA REQUEST (LGPD)
    if (containsSensitiveDataRequest(message)) {
      console.log('🔒 Sensitive data request blocked (LGPD)');
      const blockedResponse = getSensitiveDataBlockedResponse();
      
      await supabase
        .from('ai_notification_log')
        .insert({
          channel: 'whatsapp',
          recipient: from_phone,
          message_content: blockedResponse,
          status: 'generated',
          metadata: {
            original_message: message,
            contact_type,
            blocked_reason: 'lgpd_sensitive_data',
          }
        });

      return new Response(JSON.stringify({
        success: true,
        message: blockedResponse,
        blockedByLgpd: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. FETCH AGENT CONFIG
    const { data: agentConfig } = await supabase
      .from('ai_agent_config')
      .select('*')
      .eq('agent_type', contact_type)
      .maybeSingle();

    const config = agentConfig || (await supabase
      .from('ai_agent_config')
      .select('*')
      .eq('agent_type', 'carrier')
      .single()).data;

    if (!config?.is_active) {
      console.log('⚠️ Agent not active for type:', contact_type);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Agent not active',
        shouldReply: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1.5. TRY TO FIND CUSTOMER BY PHONE IF customer_id NOT PROVIDED
    let effectiveCustomerId = customer_id;
    if (!effectiveCustomerId && from_phone) {
      console.log('🔍 Strategy 0: Searching customer by phone number:', from_phone);
      
      // Create phone variations for flexible matching
      const phoneClean = from_phone.replace(/\D/g, '');
      const phoneVariations: string[] = [];
      
      phoneVariations.push(phoneClean);
      
      // Remove country code 55 if present
      let withoutCountry = phoneClean;
      if (phoneClean.startsWith('55') && phoneClean.length >= 12) {
        withoutCountry = phoneClean.substring(2);
        phoneVariations.push(withoutCountry);
      }
      
      // Handle 9th digit variations (Brazilian mobile numbers)
      if (withoutCountry.length === 10) {
        const area = withoutCountry.substring(0, 2);
        const number = withoutCountry.substring(2);
        phoneVariations.push(area + '9' + number);
      } else if (withoutCountry.length === 11 && withoutCountry.charAt(2) === '9') {
        const area = withoutCountry.substring(0, 2);
        const number = withoutCountry.substring(3);
        phoneVariations.push(area + number);
      }
      
      // Build OR query with all phone variations
      const customerOrConditions = phoneVariations
        .flatMap(variation => [
          `whatsapp.ilike.%${variation}%`,
          `phone.ilike.%${variation}%`
        ])
        .join(',');
      
      const { data: foundCustomer, error: customerSearchError } = await supabase
        .from('customer_contacts')
        .select('id, customer_name, whatsapp, phone, last_order_id')
        .or(customerOrConditions)
        .maybeSingle();
      
      if (foundCustomer && !customerSearchError) {
        console.log('✅ Found customer by phone:', foundCustomer.customer_name, '(', foundCustomer.id, ')');
        effectiveCustomerId = foundCustomer.id;
      } else {
        console.log('⚠️ Customer not found by phone');
      }
    }

    // 2. MULTI-STRATEGY ORDER SEARCH
    const orderNumber = extractOrderNumber(message);
    console.log('🔍 Extracted order number:', orderNumber);

    let orderContext: OrderContext | null = null;
    let shouldAskForOrder = false;
    let multipleOrdersFound: any[] = [];

    // STRATEGY 1: Order number in message
    if (orderNumber) {
      console.log('🔍 Strategy 1: Searching by order number in message...');
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*),
          order_tracking_events(*),
          order_occurrences(*),
          order_volumes(*),
          freight_quotes(*, freight_quote_responses(*))
        `)
        .or(`order_number.eq.${orderNumber},totvs_order_number.eq.${orderNumber}`)
        .maybeSingle();

      if (order && !orderError) {
        const slaStatus = calculateSlaStatus(order);
        orderContext = {
          order: filterOrderForCustomer(order),
          items: (order.order_items || []).map(filterOrderItemForCustomer),
          volumes: order.order_volumes || [],
          freightQuotes: order.freight_quotes || [],
          trackingEvents: order.order_tracking_events || [],
          occurrences: order.order_occurrences || [],
          slaStatus,
          source: 'message_extract'
        };
        console.log('✅ Order found by number in message:', order.order_number);
      }
    }

    // STRATEGY 2: last_order_id from customer_contacts (using effectiveCustomerId)
    if (!orderContext && effectiveCustomerId) {
      console.log('🔍 Strategy 2: Searching by customer last_order_id...');
      const { data: customer } = await supabase
        .from('customer_contacts')
        .select('last_order_id, customer_name, customer_document')
        .eq('id', effectiveCustomerId)
        .single();
      
      if (customer?.last_order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(*),
            order_tracking_events(*),
            order_occurrences(*),
            order_volumes(*),
            freight_quotes(*, freight_quote_responses(*))
          `)
          .eq('id', customer.last_order_id)
          .single();

        if (order) {
          const slaStatus = calculateSlaStatus(order);
          orderContext = {
            order: filterOrderForCustomer(order),
            items: (order.order_items || []).map(filterOrderItemForCustomer),
            volumes: order.order_volumes || [],
            freightQuotes: order.freight_quotes || [],
            trackingEvents: order.order_tracking_events || [],
            occurrences: order.order_occurrences || [],
            slaStatus,
            source: 'last_order_id'
          };
          console.log('✅ Order found by last_order_id:', order.order_number);
        }
      }
      
      // STRATEGY 3: Search by customer_name
      if (!orderContext && customer?.customer_name) {
        console.log('🔍 Strategy 3: Searching by customer_name match...');
        const firstName = customer.customer_name.split(' ')[0];
        
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(*),
            order_tracking_events(*),
            order_occurrences(*),
            order_volumes(*),
            freight_quotes(*, freight_quote_responses(*))
          `)
          .ilike('customer_name', `%${firstName}%`)
          .order('created_at', { ascending: false })
          .limit(5);

        if (orders && orders.length > 0) {
          if (orders.length === 1) {
            const order = orders[0];
            const slaStatus = calculateSlaStatus(order);
            orderContext = {
              order: filterOrderForCustomer(order),
              items: (order.order_items || []).map(filterOrderItemForCustomer),
              volumes: order.order_volumes || [],
              freightQuotes: order.freight_quotes || [],
              trackingEvents: order.order_tracking_events || [],
              occurrences: order.order_occurrences || [],
              slaStatus,
              source: 'customer_name_match'
            };
            console.log('✅ Order found by customer_name:', order.order_number);
          } else {
            multipleOrdersFound = orders;
            console.log('📋 Multiple orders found:', orders.length);
          }
        }
      }
      
      // STRATEGY 4: Search by customer_document
      if (!orderContext && !multipleOrdersFound.length && customer?.customer_document) {
        console.log('🔍 Strategy 4: Searching by customer_document...');
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(*),
            order_tracking_events(*),
            order_occurrences(*),
            order_volumes(*),
            freight_quotes(*, freight_quote_responses(*))
          `)
          .eq('customer_document', customer.customer_document)
          .order('created_at', { ascending: false })
          .limit(5);

        if (orders && orders.length > 0) {
          if (orders.length === 1) {
            const order = orders[0];
            const slaStatus = calculateSlaStatus(order);
            orderContext = {
              order: filterOrderForCustomer(order),
              items: (order.order_items || []).map(filterOrderItemForCustomer),
              volumes: order.order_volumes || [],
              freightQuotes: order.freight_quotes || [],
              trackingEvents: order.order_tracking_events || [],
              occurrences: order.order_occurrences || [],
              slaStatus,
              source: 'customer_document_match'
            };
            console.log('✅ Order found by customer_document:', order.order_number);
          } else {
            multipleOrdersFound = orders;
            console.log('📋 Multiple orders found by document:', orders.length);
          }
        }
      }
    }

    // 3. DETECT CHANGE REQUEST
    const detectedChange = detectChangeRequest(message);
    
    if (detectedChange && orderContext) {
      console.log('🔄 Change request detected:', detectedChange.type, 'Confidence:', detectedChange.confidence);
      
      // Get customer info for the request
      let customerName = orderContext.order.customer_name;
      let customerContactId = effectiveCustomerId;

      // Create change request record
      const { data: changeRequest, error: changeError } = await supabase
        .from('customer_change_requests')
        .insert({
          order_id: orderContext.order.id,
          customer_contact_id: customerContactId || null,
          requested_by_phone: from_phone,
          requested_by_name: customerName,
          change_type: detectedChange.type,
          description: message,
          original_value: detectedChange.type === 'delivery_date' 
            ? orderContext.order.delivery_date 
            : detectedChange.type === 'delivery_address' 
              ? orderContext.order.delivery_address 
              : null,
          requested_value: detectedChange.extractedValue || null,
          status: 'pending',
          conversation_id: conversation_id || null,
          organization_id: orderContext.order.organization_id,
        })
        .select()
        .single();

      if (changeError) {
        console.error('❌ Failed to create change request:', changeError);
      } else {
        console.log('✅ Change request created:', changeRequest?.id);
        
        // Notify managers
        await notifyManagersAboutChangeRequest(supabase, changeRequest, orderContext.order);

        const changeLabel = changeTypeLabels[detectedChange.type];
        const confirmationMessage = `📝 *Solicitação Registrada!*

Recebi sua solicitação de *${changeLabel}* para o pedido *#${orderContext.order.order_number}*.

${detectedChange.extractedValue ? `📌 Valor solicitado: ${detectedChange.extractedValue}\n` : ''}
⏳ Um gestor irá analisar e você receberá uma resposta em breve.

Número da solicitação: *#${changeRequest?.id?.slice(0, 8).toUpperCase()}*

Qualquer dúvida, pode me chamar! 😊`;

        // Log the interaction
        await supabase
          .from('ai_notification_log')
          .insert({
            channel: 'whatsapp',
            recipient: from_phone,
            message_content: confirmationMessage,
            order_id: orderContext.order.id,
            status: 'generated',
            metadata: {
              original_message: message,
              change_request_id: changeRequest?.id,
              change_type: detectedChange.type,
              contact_type,
            }
          });

        return new Response(JSON.stringify({
          success: true,
          message: confirmationMessage,
          changeRequestCreated: true,
          changeRequestId: changeRequest?.id,
          changeType: detectedChange.type,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if asking about order without order context
    if (!orderContext && !multipleOrdersFound.length) {
      const orderRelatedPatterns = [
        /onde\s*está/i, /cadê/i, /status/i, /situação/i,
        /entrega/i, /previsão/i, /rastreio/i, /tracking/i,
        /meu\s*pedido/i, /minha\s*compra/i, /minha\s*encomenda/i
      ];
      shouldAskForOrder = orderRelatedPatterns.some(p => p.test(message));
    }

    // 4. RAG SEARCH
    let ragContext = '';
    const ragFilters: Record<string, any> = {};

    if (orderContext) {
      if (orderContext.order.carrier_name) {
        ragFilters.carrier_name = orderContext.order.carrier_name;
      }
      if (orderContext.occurrences.length > 0) {
        ragFilters.occurrence_type = orderContext.occurrences[0].occurrence_type;
      }
      if (orderContext.slaStatus.is_breached) {
        ragFilters.sla_category = 'fora_sla';
      }
    }

    let ragQuery = supabase
      .from('ai_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .or(`agent_type.eq.${contact_type},agent_type.eq.general`)
      .order('priority', { ascending: false })
      .limit(5);

    const { data: ragDocs } = await ragQuery;

    if (ragDocs && ragDocs.length > 0) {
      const scoredDocs = ragDocs.map(doc => {
        let score = doc.priority || 0;
        if (ragFilters.carrier_name && doc.carrier_name === ragFilters.carrier_name) score += 20;
        if (ragFilters.occurrence_type && doc.occurrence_type === ragFilters.occurrence_type) score += 15;
        if (ragFilters.sla_category && doc.sla_category === ragFilters.sla_category) score += 10;
        const messageLower = message.toLowerCase();
        if (doc.keywords?.some((k: string) => messageLower.includes(k.toLowerCase()))) score += 5;
        return { ...doc, relevance_score: score };
      });

      const topDocs = scoredDocs
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 3);

      ragContext = topDocs.map(d => `[${d.category}] ${d.title}:\n${d.content}`).join('\n\n---\n\n');
    }

    // 4.1 FETCH AI RULES AND POLICIES
    console.log('📋 Fetching AI rules and policies...');
    const { data: aiRules } = await supabase
      .from('ai_rules')
      .select('policy, rule, rule_description, rule_risk, action')
      .eq('is_active', true)
      .limit(20);

    const rulesContext = (aiRules && aiRules.length > 0)
      ? aiRules.map(r => `- [${r.policy}] ${r.rule_description} (Risco: ${r.rule_risk}, Ação: ${r.action})`).join('\n')
      : '';
    
    console.log(`📋 Found ${aiRules?.length || 0} active rules`)

    // 5. CHECK ESCALATION RULES
    let shouldEscalate = false;
    let escalationReason = '';

    if (orderContext) {
      const { slaStatus, occurrences } = orderContext;
      if (slaStatus.is_breached) {
        shouldEscalate = true;
        escalationReason = 'SLA violado';
      }
      if (occurrences.some((o: any) => o.severity === 'critical' && !o.resolved)) {
        shouldEscalate = true;
        escalationReason = 'Ocorrência crítica';
      }
      if (occurrences.some((o: any) => o.occurrence_type === 'extravio' && !o.resolved)) {
        shouldEscalate = true;
        escalationReason = 'Extravio';
      }
    }

    if (detectNegativeSentiment(message)) {
      shouldEscalate = true;
      escalationReason = 'Sentimento negativo detectado';
    }
    if (containsFinancialMention(message)) {
      shouldEscalate = true;
      escalationReason = 'Menção financeira';
    }

    const handoffKeywords = config.human_handoff_keywords || [];
    if (handoffKeywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()))) {
      shouldEscalate = true;
      escalationReason = 'Solicitação de atendimento humano';
    }

    console.log('🚨 Escalation check:', shouldEscalate, escalationReason);

    // 6. BUILD LLM PROMPT
    const systemPrompt = `Você é o ${config.agent_name}, Agente de Logística da IMPLY Tecnologia.

PAPEL: Atendimento automático de pedidos, envios, atrasos, entregas e SLA.

REGRAS CRÍTICAS:
1. NUNCA invente status, prazos ou ocorrências
2. Use APENAS os dados fornecidos no contexto
3. Se algo não estiver disponível, informe com clareza
4. Seja tranquilizador mas honesto
5. Sempre diga o PRÓXIMO PASSO esperado
6. Se não houver número de pedido, peça educadamente
7. NUNCA revele preços, margens, descontos ou dados financeiros
8. NUNCA mencione nomes de vendedores ou executivos

${rulesContext ? `📋 POLÍTICAS E REGRAS DA EMPRESA:\n${rulesContext}\n` : ''}

TOM DE VOZ: ${config.tone_of_voice}
PERSONALIDADE: ${config.personality}
IDIOMA: ${config.language}

FORMATAÇÃO: WhatsApp (*negrito*, _itálico_, emojis moderados)

${config.custom_instructions || ''}`;

    let userPrompt = '';

    if (multipleOrdersFound.length > 1) {
      const ordersList = multipleOrdersFound.map((o, i) => 
        `${i + 1}. *#${o.order_number}* - ${translateStatus(o.status)} - ${formatDate(o.delivery_date)}`
      ).join('\n');
      
      userPrompt = `MENSAGEM DO CLIENTE:
${message}

Encontrei ${multipleOrdersFound.length} pedidos associados a este contato:
${ordersList}

Gere uma resposta amigável listando esses pedidos e pedindo para o cliente informar sobre qual pedido deseja informações. Use formatação WhatsApp.`;
    } else if (shouldAskForOrder && !orderNumber && !orderContext) {
      userPrompt = `MENSAGEM DO CLIENTE:
${message}

O cliente parece estar perguntando sobre um pedido, mas não informou o número e não encontrei pedidos vinculados a este contato.
Responda pedindo o número do pedido de forma educada e prestativa.`;
    } else if (orderContext) {
      const lastEvent = orderContext.trackingEvents
        .sort((a: any, b: any) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())[0];
      
      const activeOccurrences = orderContext.occurrences.filter((o: any) => !o.resolved);
      
      const itemsList = orderContext.items.slice(0, 5).map((item: any) => 
        `• ${item.requested_quantity}x ${item.item_description || item.item_code}`
      ).join('\n');

      // Calculate volumes info
      const totalWeight = orderContext.volumes.reduce((sum: number, v: any) => sum + (v.weight_kg || 0), 0);
      const volumeCount = orderContext.volumes.length;
      const volumesList = orderContext.volumes.slice(0, 3).map((v: any) => 
        `  - Vol ${v.volume_number}: ${v.length_cm || '?'}x${v.width_cm || '?'}x${v.height_cm || '?'} cm (${v.weight_kg || '?'} kg)`
      ).join('\n');

      // Get freight info
      const selectedQuote = orderContext.freightQuotes.find((q: any) => 
        q.freight_quote_responses?.some((r: any) => r.is_selected)
      );

      userPrompt = `DADOS DO PEDIDO (encontrado via: ${orderContext.source}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *Pedido #${orderContext.order.order_number}*
👤 Cliente: ${orderContext.order.customer_name}
📍 Status: ${translateStatus(orderContext.order.status)}
🚚 Transportadora: ${orderContext.order.carrier_name || 'Não definida'}
📋 Código de Rastreio: ${orderContext.order.tracking_code || 'Aguardando'}
📅 Data de Envio: ${formatDate(orderContext.order.shipping_date)}
📆 Previsão de Entrega: ${formatDate(orderContext.order.delivery_date)}
⏱️ SLA: ${orderContext.slaStatus.days_remaining >= 0 ? `${orderContext.slaStatus.days_remaining} dias restantes` : `${Math.abs(orderContext.slaStatus.days_remaining)} dias em atraso`}

ITENS DO PEDIDO:
${itemsList || 'Sem itens registrados'}
${orderContext.items.length > 5 ? `... e mais ${orderContext.items.length - 5} item(s)` : ''}

📦 VOLUMES E MEDIDAS:
• Total de volumes: ${volumeCount}
• Peso total: ${totalWeight.toFixed(2)} kg
${volumesList || '  Sem volumes registrados'}

💰 FRETE:
• Modalidade: ${orderContext.order.freight_type || 'A definir'}
• Transportadora: ${orderContext.order.carrier_name || 'Não selecionada'}
• Código de rastreio: ${orderContext.order.tracking_code || 'Ainda não gerado'}

HISTÓRICO DE RASTREIO:
${lastEvent 
  ? `📍 ${formatDate(lastEvent.event_datetime)} - ${lastEvent.event_description || lastEvent.event_code}\n   Local: ${lastEvent.location || 'Não informado'}`
  : '⏳ Aguardando movimentação'}

${activeOccurrences.length > 0 
  ? `\n⚠️ OCORRÊNCIAS ATIVAS:\n${activeOccurrences.map((o: any) => `• ${o.occurrence_type}: ${o.description || 'Sem descrição'}`).join('\n')}`
  : ''}

DOCUMENTOS LOGÍSTICOS RELEVANTES:
${ragContext || 'Nenhum documento específico encontrado'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MENSAGEM DO CLIENTE:
${message}

${shouldEscalate 
  ? `⚠️ ATENÇÃO: Este caso requer escalonamento (${escalationReason}). Informe o cliente que um atendente humano entrará em contato em breve.`
  : 'INSTRUÇÕES:\n- Gere uma resposta completa e informativa usando os dados acima\n- Use formatação WhatsApp (*negrito*, emojis)\n- Seja objetivo e tranquilizador\n- Informe o próximo passo esperado baseado no status atual\n- NUNCA mencione preços, valores ou custos'}`;
    } else if (orderNumber) {
      userPrompt = `MENSAGEM DO CLIENTE:
${message}

O cliente mencionou o pedido número ${orderNumber}, mas este pedido não foi encontrado em nossa base.
Informe educadamente que não encontrou o pedido e peça para confirmar o número ou fornecer mais detalhes (como CPF/CNPJ ou nome completo).`;
    } else {
      userPrompt = `DOCUMENTOS RELEVANTES:
${ragContext || 'Nenhum documento específico'}

MENSAGEM DO CLIENTE:
${message}

Responda de forma prestativa. Se a pergunta for sobre um pedido específico, peça o número do pedido.`;
    }

    // 7. CALL LLM
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llm_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 700,
        temperature: 0.7,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('❌ LLM Error:', llmResponse.status, errorText);
      throw new Error(`LLM error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    let generatedMessage = llmData.choices?.[0]?.message?.content || '';

    if (config.use_signature && config.signature && !generatedMessage.includes(config.signature)) {
      generatedMessage += `\n\n${config.signature}`;
    }

    console.log('💬 Generated response:', generatedMessage.substring(0, 200));

    // 8. LOG THE INTERACTION
    await supabase
      .from('ai_notification_log')
      .insert({
        channel: 'whatsapp',
        recipient: from_phone,
        message_content: generatedMessage,
        order_id: orderContext?.order?.id,
        status: 'generated',
        metadata: {
          original_message: message,
          order_number: orderNumber || orderContext?.order?.order_number,
          contact_type,
          customer_id,
          order_search_source: orderContext?.source || (multipleOrdersFound.length > 1 ? 'multiple_found' : 'not_found'),
          should_escalate: shouldEscalate,
          escalation_reason: escalationReason,
          rag_docs_used: ragDocs?.length || 0,
          sla_status: orderContext?.slaStatus,
          multiple_orders_count: multipleOrdersFound.length,
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: generatedMessage,
      orderFound: !!orderContext,
      orderNumber: orderNumber || orderContext?.order?.order_number,
      orderSearchSource: orderContext?.source,
      multipleOrdersFound: multipleOrdersFound.length,
      shouldEscalate,
      escalationReason,
      slaStatus: orderContext?.slaStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Logistics Reply Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

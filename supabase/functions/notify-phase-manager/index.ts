import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  orderId: string;
  oldStatus?: string;
  newStatus: string;
  orderType?: string;
  orderCategory?: string;
  notificationType?: 'new_order' | 'status_change' | 'urgent_alert';
  customMessage?: string;
}

interface TriggerConfig {
  id: string;
  trigger_name: string;
  trigger_type: string;
  trigger_status: string[];
  is_active: boolean;
  include_order_number: boolean;
  include_customer_name: boolean;
  include_item_count: boolean;
  include_total_value: boolean;
  include_status: boolean;
  include_delivery_date: boolean;
  include_days_until_delivery: boolean;
  include_phase_info: boolean;
  include_item_list: boolean;
  include_priority: boolean;
  priority: number;
  delay_minutes: number;
  custom_template: string | null;
}

// Status labels for display
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  received: 'Recebido',
  purchase_pending: 'Aguardando Compra',
  purchase_required: 'Compra Necessária',
  awaiting_material: 'Aguardando Material',
  separation_started: 'Separação Iniciada',
  in_production: 'Em Produção',
  separation_completed: 'Separação Concluída',
  production_completed: 'Produção Concluída',
  awaiting_lab: 'Aguardando Lab',
  in_lab_analysis: 'Em Análise Lab',
  lab_completed: 'Lab Concluído',
  freight_quote_requested: 'Cotação Solicitada',
  freight_quote_received: 'Cotação Recebida',
  freight_approved: 'Frete Aprovado',
  released_for_shipping: 'Liberado p/ Expedição',
  in_expedition: 'Em Expedição',
  pickup_scheduled: 'Coleta Agendada',
  awaiting_pickup: 'Aguardando Coleta',
  ready_to_invoice: 'Pronto p/ Faturar',
  invoiced: 'Faturado',
  delivered: 'Entregue',
  completed: 'Concluído',
};

// Mapeamento de status para fase
function getPhaseFromStatus(status: string, orderCategory?: string): string | null {
  // Compras
  if (['purchase_pending', 'purchase_required', 'awaiting_material'].includes(status)) {
    return 'purchases';
  }
  
  // Produção - diferenciar por categoria
  if (['separation_started', 'in_production', 'separation_completed', 'production_completed'].includes(status)) {
    if (orderCategory === 'estoque') {
      return 'production_stock';
    }
    return 'production_client';
  }
  
  // Laboratório
  if (['awaiting_lab', 'in_lab_analysis', 'lab_completed'].includes(status)) {
    return 'laboratory';
  }
  
  // Frete
  if (['freight_quote_requested', 'freight_quote_received', 'freight_approved'].includes(status)) {
    return 'freight_quote';
  }
  
  // Expedição
  if (['released_for_shipping', 'in_expedition', 'pickup_scheduled', 'awaiting_pickup'].includes(status)) {
    return 'logistics';
  }
  
  return null;
}

// Build dynamic message based on trigger config
function buildDynamicMessage(
  trigger: TriggerConfig,
  order: any,
  items: any[],
  phase: string | null
): string {
  // If custom template exists, use it
  if (trigger.custom_template) {
    let message = trigger.custom_template;
    message = message.replace('{order_number}', order.order_number || order.id?.slice(0, 8) || '');
    message = message.replace('{customer_name}', order.customer_name || 'N/A');
    message = message.replace('{total_value}', formatCurrency(order.total_value || 0));
    message = message.replace('{status}', STATUS_LABELS[order.status] || order.status);
    message = message.replace('{delivery_date}', formatDate(order.delivery_date));
    message = message.replace('{item_count}', String(items.length));
    return message;
  }

  // Build message dynamically based on config
  const orderNumber = order.order_number || order.id?.slice(0, 8);
  let message = `📋 *${trigger.trigger_name.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━\n`;

  if (trigger.include_order_number) {
    message += `📦 Pedido: #${orderNumber}\n`;
  }

  if (trigger.include_customer_name) {
    message += `👤 Cliente: ${order.customer_name || 'N/A'}\n`;
  }

  if (trigger.include_item_count) {
    message += `📊 Itens: ${items.length}\n`;
  }

  if (trigger.include_total_value) {
    message += `💰 Valor: ${formatCurrency(order.total_value || 0)}\n`;
  }

  if (trigger.include_status) {
    message += `🏷️ Status: ${STATUS_LABELS[order.status] || order.status}\n`;
  }

  if (trigger.include_delivery_date && order.delivery_date) {
    message += `📅 Entrega: ${formatDate(order.delivery_date)}\n`;
  }

  if (trigger.include_days_until_delivery && order.delivery_date) {
    const days = calculateDaysUntil(order.delivery_date);
    if (days >= 0) {
      message += `⏱️ Prazo: ${days} dia${days !== 1 ? 's' : ''}\n`;
    } else {
      message += `⚠️ Atrasado: ${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''}\n`;
    }
  }

  if (trigger.include_phase_info && phase) {
    const phaseLabels: Record<string, string> = {
      purchases: 'Compras',
      production_client: 'Produção Cliente',
      production_stock: 'Produção Estoque',
      laboratory: 'Laboratório',
      freight_quote: 'Cotação Frete',
      logistics: 'Expedição',
    };
    message += `📍 Fase: ${phaseLabels[phase] || phase}\n`;
  }

  if (trigger.include_priority && order.priority) {
    const priorityLabels: Record<string, string> = {
      high: '🔴 Alta',
      medium: '🟡 Média',
      low: '🟢 Baixa',
    };
    message += `⚡ Prioridade: ${priorityLabels[order.priority] || order.priority}\n`;
  }

  if (trigger.include_item_list && items.length > 0) {
    message += `\n📋 *Itens:*\n`;
    items.slice(0, 5).forEach(item => {
      const desc = item.description ? item.description.substring(0, 30) : '';
      message += `• ${item.item_code || 'N/A'}: ${desc}${desc.length >= 30 ? '...' : ''}\n`;
    });
    if (items.length > 5) {
      message += `_...e mais ${items.length - 5} ite${items.length - 5 !== 1 ? 'ns' : 'm'}_\n`;
    }
  }

  message += `\n💬 Responda "ver ${orderNumber}" para detalhes`;

  return message;
}

// Helper functions
function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Não definida';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function calculateDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Fallback templates when no trigger config exists
function getFallbackTemplate(
  phase: string,
  order: any,
  items: any[],
  notificationType: string
): string {
  const orderNumber = order.order_number || order.id?.slice(0, 8);
  const customerName = order.customer_name || 'N/A';
  const deliveryDate = formatDate(order.delivery_date);
  const totalValue = formatCurrency(order.total_value || 0);
  
  const templates: Record<string, string> = {
    purchases: `🛒 *SOLICITAÇÃO DE COMPRA*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📊 Itens: ${items.length}
💰 Valor: ${totalValue}
📅 Entrega: ${deliveryDate}

⚠️ Itens necessitam compra

💬 Responda "ver ${orderNumber}" para detalhes`,

    production_client: `🔧 *PEDIDO EM PRODUÇÃO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📊 Itens: ${items.length}
💰 Valor: ${totalValue}
📅 Entrega: ${deliveryDate}

💬 Responda "status ${orderNumber}" para atualizar`,

    production_stock: `📦 *ORDEM DE ESTOQUE*
━━━━━━━━━━━━━━━━━━
📦 Ordem: #${orderNumber}
🏭 Tipo: Reposição de Estoque
📊 Itens: ${items.length}
📅 Prazo: ${deliveryDate}

💬 Responda "prioridade alta ${orderNumber}" se urgente`,

    laboratory: `🔬 *PEDIDO NO LABORATÓRIO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📊 Itens: ${items.length}
💰 Valor: ${totalValue}
📅 Entrega: ${deliveryDate}

💬 Responda "ver ${orderNumber}" para detalhes`,

    freight_quote: `🚚 *COTAÇÃO DE FRETE*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📊 Itens: ${items.length}
💰 Valor: ${totalValue}
📅 Entrega: ${deliveryDate}

💬 Aguardando cotação de frete`,

    logistics: `📤 *EXPEDIÇÃO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📊 Itens: ${items.length}
💰 Valor: ${totalValue}
📅 Entrega: ${deliveryDate}

💬 Pedido pronto para expedição`
  };

  return templates[phase] || `📋 *ATUALIZAÇÃO DE PEDIDO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📊 Itens: ${items.length}
💰 Valor: ${totalValue}
🏷️ Status: ${STATUS_LABELS[order.status] || order.status}

💬 Responda "ver ${orderNumber}" para detalhes`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyRequest = await req.json();
    const { orderId, oldStatus, newStatus, orderType, orderCategory, notificationType = 'status_change', customMessage } = body;

    console.log(`[notify-phase-manager] Processing notification for order ${orderId}`);
    console.log(`[notify-phase-manager] Status change: ${oldStatus} -> ${newStatus}`);

    // Determinar fase de destino
    const targetPhase = getPhaseFromStatus(newStatus, orderCategory);

    // Buscar dados do pedido com itens para calcular valor total
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        delivery_date,
        status,
        order_type,
        order_category,
        organization_id,
        priority,
        order_items(id, item_code, description, total_value)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`[notify-phase-manager] Order not found: ${orderId}`, orderError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const items = (order as any).order_items || [];

    // Calcular valor total do pedido a partir dos itens
    const calculatedTotalValue = items.reduce(
      (sum: number, item: { total_value: number | null }) => sum + (item.total_value || 0), 
      0
    );

    // Adicionar total_value calculado ao objeto order para uso no template
    const orderWithTotal = { ...order, total_value: calculatedTotalValue };

    // Buscar configurações de gatilho que correspondem ao status
    const { data: triggerConfigs } = await supabase
      .from('ai_manager_trigger_config')
      .select('*')
      .eq('organization_id', order.organization_id)
      .eq('is_active', true)
      .contains('trigger_status', [newStatus]);

    console.log(`[notify-phase-manager] Found ${triggerConfigs?.length || 0} matching trigger configs`);

    // Se não há trigger configurado E não há fase mapeada, retornar
    if ((!triggerConfigs || triggerConfigs.length === 0) && !targetPhase) {
      console.log(`[notify-phase-manager] No trigger config and no phase mapping for status: ${newStatus}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No notification needed for this status',
        phase: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use o trigger com maior prioridade se existir, senão use fallback
    const trigger = triggerConfigs && triggerConfigs.length > 0 
      ? triggerConfigs.sort((a, b) => a.priority - b.priority)[0] as TriggerConfig
      : null;

    console.log(`[notify-phase-manager] Using trigger: ${trigger?.trigger_name || 'fallback'}`);
    console.log(`[notify-phase-manager] Target phase: ${targetPhase}`);

    // Buscar gestor da fase (usar targetPhase mesmo que tenhamos trigger)
    const phaseToQuery = targetPhase;
    
    if (!phaseToQuery) {
      console.log(`[notify-phase-manager] No phase to notify managers`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No phase manager mapping for this status',
        phase: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: managers, error: managerError } = await supabase
      .from('phase_managers')
      .select(`
        id,
        user_id,
        whatsapp,
        receive_new_orders,
        receive_urgent_alerts,
        profiles:user_id (full_name)
      `)
      .eq('phase_key', phaseToQuery)
      .eq('is_active', true)
      .eq('organization_id', order.organization_id)
      .order('notification_priority', { ascending: true });

    if (managerError) {
      console.error(`[notify-phase-manager] Error fetching managers:`, managerError);
    }

    if (!managers || managers.length === 0) {
      console.log(`[notify-phase-manager] No active managers for phase: ${phaseToQuery}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No managers configured for this phase',
        phase: phaseToQuery
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[notify-phase-manager] Found ${managers.length} managers for phase ${phaseToQuery}`);

    // Gerar mensagem
    let messageContent: string;
    if (customMessage) {
      messageContent = customMessage;
    } else if (trigger) {
      messageContent = buildDynamicMessage(trigger, orderWithTotal, items, phaseToQuery);
    } else {
      messageContent = getFallbackTemplate(phaseToQuery, orderWithTotal, items, notificationType);
    }

    // Enviar notificação para cada gestor
    const notifications = [];
    
    for (const manager of managers) {
      // Verificar preferências
      if (notificationType === 'new_order' && !manager.receive_new_orders) {
        console.log(`[notify-phase-manager] Manager ${manager.user_id} opted out of new order notifications`);
        continue;
      }
      if (notificationType === 'urgent_alert' && !manager.receive_urgent_alerts) {
        console.log(`[notify-phase-manager] Manager ${manager.user_id} opted out of urgent alerts`);
        continue;
      }

      // Normalizar WhatsApp
      let whatsapp = manager.whatsapp.replace(/\D/g, '');
      if (!whatsapp.startsWith('55')) {
        whatsapp = '55' + whatsapp;
      }

      // Criar log de notificação
      const { data: notification, error: notifError } = await supabase
        .from('phase_manager_notifications')
        .insert({
          phase_manager_id: manager.id,
          order_id: orderId,
          notification_type: notificationType,
          message_content: messageContent,
          status: 'pending',
          metadata: {
            phase: phaseToQuery,
            old_status: oldStatus,
            new_status: newStatus,
            manager_name: (manager.profiles as any)?.full_name,
            trigger_id: trigger?.id,
            trigger_name: trigger?.trigger_name
          }
        })
        .select()
        .single();

      if (notifError) {
        console.error(`[notify-phase-manager] Error creating notification log:`, notifError);
      }

      // Adicionar à fila de mensagens com delay configurado
      const { error: queueError } = await supabase
        .from('message_queue')
        .insert({
          recipient_whatsapp: whatsapp,
          recipient_name: (manager.profiles as any)?.full_name || 'Gestor',
          message_content: messageContent,
          message_type: 'phase_manager_alert',
          priority: trigger?.priority || (notificationType === 'urgent_alert' ? 1 : 2),
          scheduled_for: trigger?.delay_minutes 
            ? new Date(Date.now() + trigger.delay_minutes * 60 * 1000).toISOString()
            : null,
          metadata: {
            notification_id: notification?.id,
            order_id: orderId,
            phase: phaseToQuery,
            notification_type: notificationType,
            trigger_id: trigger?.id
          }
        });

      if (queueError) {
        console.error(`[notify-phase-manager] Error queueing message:`, queueError);
        
        // Atualizar status da notificação
        if (notification) {
          await supabase
            .from('phase_manager_notifications')
            .update({ 
              status: 'failed',
              error_message: queueError.message 
            })
            .eq('id', notification.id);
        }
      } else {
        console.log(`[notify-phase-manager] Message queued for ${whatsapp}`);
        notifications.push({
          manager_id: manager.id,
          whatsapp,
          notification_id: notification?.id
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      phase: phaseToQuery,
      trigger_used: trigger?.trigger_name || 'fallback',
      notifications_sent: notifications.length,
      notifications
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[notify-phase-manager] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

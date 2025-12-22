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

// Templates de mensagem por fase
function getMessageTemplate(
  phase: string,
  order: any,
  notificationType: string
): string {
  const orderNumber = order.order_number || order.id?.slice(0, 8);
  const customerName = order.customer_name || 'N/A';
  const deliveryDate = order.delivery_date 
    ? new Date(order.delivery_date).toLocaleDateString('pt-BR')
    : 'Não definida';
  const totalValue = order.total_value 
    ? `R$ ${Number(order.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : 'N/A';
  
  const templates: Record<string, string> = {
    purchases: `🛒 *SOLICITAÇÃO DE COMPRA*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📅 Entrega: ${deliveryDate}

⚠️ Itens necessitam compra

💬 Responda "ver ${orderNumber}" para detalhes`,

    production_client: `🔧 *PEDIDO EM PRODUÇÃO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📅 Entrega: ${deliveryDate}
💰 Valor: ${totalValue}

💬 Responda "status ${orderNumber}" para atualizar`,

    production_stock: `📦 *ORDEM DE ESTOQUE*
━━━━━━━━━━━━━━━━━━
📦 Ordem: #${orderNumber}
🏭 Tipo: Reposição de Estoque
📅 Prazo: ${deliveryDate}

💬 Responda "prioridade alta ${orderNumber}" se urgente`,

    laboratory: `🔬 *PEDIDO NO LABORATÓRIO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📅 Entrega: ${deliveryDate}

💬 Responda "ver ${orderNumber}" para detalhes`,

    freight_quote: `🚚 *COTAÇÃO DE FRETE*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📅 Entrega: ${deliveryDate}

💬 Aguardando cotação de frete`,

    logistics: `📤 *EXPEDIÇÃO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📅 Entrega: ${deliveryDate}

💬 Pedido pronto para expedição`
  };

  return templates[phase] || `📋 *ATUALIZAÇÃO DE PEDIDO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${orderNumber}
👤 Cliente: ${customerName}
📅 Entrega: ${deliveryDate}

💬 Status atualizado para: ${order.status}`;
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
    
    if (!targetPhase) {
      console.log(`[notify-phase-manager] No phase manager mapping for status: ${newStatus}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No phase manager needed for this status',
        phase: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[notify-phase-manager] Target phase: ${targetPhase}`);

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
        order_items(total_value)
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

    // Calcular valor total do pedido a partir dos itens
    const calculatedTotalValue = (order as any).order_items?.reduce(
      (sum: number, item: { total_value: number | null }) => sum + (item.total_value || 0), 
      0
    ) || 0;

    // Adicionar total_value calculado ao objeto order para uso no template
    const orderWithTotal = { ...order, total_value: calculatedTotalValue };

    // Buscar gestor da fase
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
      .eq('phase_key', targetPhase)
      .eq('is_active', true)
      .eq('organization_id', order.organization_id)
      .order('notification_priority', { ascending: true });

    if (managerError) {
      console.error(`[notify-phase-manager] Error fetching managers:`, managerError);
    }

    if (!managers || managers.length === 0) {
      console.log(`[notify-phase-manager] No active managers for phase: ${targetPhase}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No managers configured for this phase',
        phase: targetPhase
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[notify-phase-manager] Found ${managers.length} managers for phase ${targetPhase}`);

    // Gerar mensagem usando order com total calculado
    const messageContent = customMessage || getMessageTemplate(targetPhase, orderWithTotal, notificationType);

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
            phase: targetPhase,
            old_status: oldStatus,
            new_status: newStatus,
            manager_name: (manager.profiles as any)?.full_name
          }
        })
        .select()
        .single();

      if (notifError) {
        console.error(`[notify-phase-manager] Error creating notification log:`, notifError);
      }

      // Adicionar à fila de mensagens
      const { error: queueError } = await supabase
        .from('message_queue')
        .insert({
          recipient_whatsapp: whatsapp,
          recipient_name: (manager.profiles as any)?.full_name || 'Gestor',
          message_content: messageContent,
          message_type: 'phase_manager_alert',
          priority: notificationType === 'urgent_alert' ? 1 : 2,
          metadata: {
            notification_id: notification?.id,
            order_id: orderId,
            phase: targetPhase,
            notification_type: notificationType
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
      phase: targetPhase,
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

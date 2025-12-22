import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhaseConfig {
  phase_key: string;
  display_name: string;
  max_days_allowed: number;
  warning_days: number;
  stall_alerts_enabled: boolean;
  manager_user_id: string | null;
  organization_id: string;
}

interface StalledOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  status: string;
  phase_key: string;
  days_in_phase: number;
  delivery_date: string | null;
  organization_id: string;
}

// Mapeamento de status para phase_key
function getPhaseKeyFromStatus(status: string): string | null {
  const statusToPhase: Record<string, string> = {
    // Almox SSM
    'almox_ssm_pending': 'almox_ssm',
    'almox_ssm_received': 'almox_ssm',
    'almox_ssm_in_review': 'almox_ssm',
    'almox_ssm_approved': 'almox_ssm',
    // Gerar Ordem
    'order_generation_pending': 'order_generation',
    'order_in_creation': 'order_generation',
    'order_generated': 'order_generation',
    // Almox Geral
    'almox_general_received': 'almox_general',
    'almox_general_separating': 'almox_general',
    'almox_general_ready': 'almox_general',
    // Produção
    'separation_started': 'production_client',
    'in_production': 'production_client',
    'awaiting_material': 'production_client',
    'separation_completed': 'production_client',
    'production_completed': 'production_client',
    // Gerar Saldo
    'balance_calculation': 'balance_generation',
    'balance_review': 'balance_generation',
    'balance_approved': 'balance_generation',
    // Laboratório
    'awaiting_lab': 'laboratory',
    'in_lab_analysis': 'laboratory',
    'lab_completed': 'laboratory',
    // Embalagem
    'in_quality_check': 'packaging',
    'in_packaging': 'packaging',
    'ready_for_shipping': 'packaging',
    // Cotação de Frete
    'freight_quote_requested': 'freight_quote',
    'freight_quote_received': 'freight_quote',
    'freight_approved': 'freight_quote',
    // À Faturar
    'ready_to_invoice': 'ready_to_invoice',
    'pending_invoice_request': 'ready_to_invoice',
    // Faturamento
    'invoice_requested': 'invoicing',
    'awaiting_invoice': 'invoicing',
    'invoice_issued': 'invoicing',
    'invoice_sent': 'invoicing',
    // Expedição
    'released_for_shipping': 'logistics',
    'in_expedition': 'logistics',
    'pickup_scheduled': 'logistics',
    'awaiting_pickup': 'logistics',
    // Em Trânsito
    'in_transit': 'in_transit',
    'collected': 'in_transit',
  };
  
  return statusToPhase[status] || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[check-stalled-orders] Starting stalled orders check...');

    // Buscar todas as fases com alertas habilitados
    const { data: phaseConfigs, error: phaseError } = await supabase
      .from('phase_config')
      .select('phase_key, display_name, max_days_allowed, warning_days, stall_alerts_enabled, manager_user_id, organization_id')
      .eq('stall_alerts_enabled', true);

    if (phaseError) {
      console.error('[check-stalled-orders] Error fetching phase configs:', phaseError);
      throw phaseError;
    }

    console.log(`[check-stalled-orders] Found ${phaseConfigs?.length || 0} phases with alerts enabled`);

    // Buscar pedidos ativos (não concluídos) com data de última atualização
    const excludedStatuses = ['completed', 'delivered', 'cancelled', 'returned', 'on_hold'];
    
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, status, updated_at, delivery_date, organization_id')
      .not('status', 'in', `(${excludedStatuses.join(',')})`)
      .order('updated_at', { ascending: true });

    if (ordersError) {
      console.error('[check-stalled-orders] Error fetching active orders:', ordersError);
      throw ordersError;
    }

    console.log(`[check-stalled-orders] Found ${activeOrders?.length || 0} active orders to check`);

    const now = new Date();
    const alertsCreated: { orderId: string; orderNumber: string; alertType: string; daysStalled: number }[] = [];
    const notificationsSent: { orderId: string; managerId: string; whatsapp: string }[] = [];

    for (const order of activeOrders || []) {
      const phaseKey = getPhaseKeyFromStatus(order.status);
      
      if (!phaseKey) {
        continue;
      }

      // Buscar configuração da fase para esta organização
      const phaseConfig = (phaseConfigs as PhaseConfig[])?.find(
        pc => pc.phase_key === phaseKey && pc.organization_id === order.organization_id
      );

      if (!phaseConfig) {
        continue;
      }

      // Calcular dias na fase atual
      const lastUpdated = new Date(order.updated_at);
      const daysInPhase = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

      // Verificar se já existe alerta ativo para este pedido/fase
      const { data: existingAlerts } = await supabase
        .from('phase_stall_alerts')
        .select('id, alert_type, days_stalled')
        .eq('order_id', order.id)
        .eq('phase_key', phaseKey)
        .in('status', ['pending', 'sent']);

      let shouldCreateWarning = false;
      let shouldCreateCritical = false;
      let shouldEscalate = false;

      // Verificar se precisa de alerta de warning
      if (daysInPhase >= phaseConfig.warning_days && daysInPhase < phaseConfig.max_days_allowed) {
        const hasWarning = existingAlerts?.some(a => a.alert_type === 'warning');
        if (!hasWarning) {
          shouldCreateWarning = true;
        }
      }

      // Verificar se precisa de alerta crítico
      if (daysInPhase >= phaseConfig.max_days_allowed) {
        const hasCritical = existingAlerts?.some(a => a.alert_type === 'critical');
        if (!hasCritical) {
          shouldCreateCritical = true;
        }

        // Escalar se passou mais de 2x o limite
        if (daysInPhase >= phaseConfig.max_days_allowed * 2) {
          const hasEscalation = existingAlerts?.some(a => a.alert_type === 'escalation');
          if (!hasEscalation) {
            shouldEscalate = true;
          }
        }
      }

      // Criar alertas
      const alertsToCreate = [];
      if (shouldCreateWarning) alertsToCreate.push('warning');
      if (shouldCreateCritical) alertsToCreate.push('critical');
      if (shouldEscalate) alertsToCreate.push('escalation');

      for (const alertType of alertsToCreate) {
        console.log(`[check-stalled-orders] Creating ${alertType} alert for order ${order.order_number} (${daysInPhase} days in ${phaseKey})`);

        // Inserir alerta
        const { data: alert, error: alertError } = await supabase
          .from('phase_stall_alerts')
          .insert({
            order_id: order.id,
            phase_key: phaseKey,
            manager_user_id: phaseConfig.manager_user_id,
            days_stalled: daysInPhase,
            alert_type: alertType,
            organization_id: order.organization_id
          })
          .select()
          .single();

        if (alertError) {
          console.error(`[check-stalled-orders] Error creating alert:`, alertError);
          continue;
        }

        alertsCreated.push({
          orderId: order.id,
          orderNumber: order.order_number,
          alertType,
          daysStalled: daysInPhase
        });

        // Buscar gestor para notificar
        let managerToNotify = null;

        // Primeiro, tentar usar o manager_user_id da fase
        if (phaseConfig.manager_user_id) {
          const { data: managerProfile } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', phaseConfig.manager_user_id)
            .single();

          if (managerProfile?.phone) {
            managerToNotify = {
              user_id: managerProfile.id,
              full_name: managerProfile.full_name,
              whatsapp: managerProfile.phone
            };
          }
        }

        // Fallback: buscar em phase_managers
        if (!managerToNotify) {
          const { data: phaseManager } = await supabase
            .from('phase_managers')
            .select('user_id, whatsapp, profiles:user_id(full_name)')
            .eq('phase_key', phaseKey)
            .eq('organization_id', order.organization_id)
            .eq('is_active', true)
            .eq('receive_urgent_alerts', true)
            .order('notification_priority', { ascending: true })
            .limit(1)
            .single();

          if (phaseManager) {
            managerToNotify = {
              user_id: phaseManager.user_id,
              full_name: (phaseManager.profiles as any)?.full_name,
              whatsapp: phaseManager.whatsapp
            };
          }
        }

        if (!managerToNotify) {
          console.log(`[check-stalled-orders] No manager found for phase ${phaseKey}`);
          continue;
        }

        // Normalizar WhatsApp
        let whatsapp = managerToNotify.whatsapp.replace(/\D/g, '');
        if (!whatsapp.startsWith('55')) {
          whatsapp = '55' + whatsapp;
        }

        // Criar mensagem de alerta
        const alertEmoji = alertType === 'critical' ? '🚨' : alertType === 'escalation' ? '⚠️🚨' : '⚠️';
        const alertLabel = alertType === 'critical' ? 'CRÍTICO' : alertType === 'escalation' ? 'ESCALAÇÃO' : 'AVISO';
        
        const deliveryInfo = order.delivery_date 
          ? `📅 Entrega: ${new Date(order.delivery_date).toLocaleDateString('pt-BR')}`
          : '';

        const messageContent = `${alertEmoji} *ALERTA DE ESTAGNAÇÃO - ${alertLabel}*
━━━━━━━━━━━━━━━━━━
📦 Pedido: #${order.order_number}
👤 Cliente: ${order.customer_name || 'N/A'}
🏷️ Fase: ${phaseConfig.display_name}
⏱️ Parado há: *${daysInPhase} dias*
${deliveryInfo}

${alertType === 'critical' 
  ? '❌ Pedido excedeu o tempo máximo permitido!'
  : alertType === 'escalation'
  ? '🔴 Pedido em estado crítico - necessita ação imediata!'
  : '⏰ Pedido próximo do limite de tempo.'}

💬 Responda "ver ${order.order_number}" para detalhes`;

        // Adicionar à fila de mensagens
        const { error: queueError } = await supabase
          .from('message_queue')
          .insert({
            recipient_whatsapp: whatsapp,
            recipient_name: managerToNotify.full_name || 'Gestor',
            message_content: messageContent,
            message_type: 'stall_alert',
            priority: alertType === 'critical' || alertType === 'escalation' ? 1 : 2,
            metadata: {
              alert_id: alert.id,
              order_id: order.id,
              phase_key: phaseKey,
              alert_type: alertType,
              days_stalled: daysInPhase
            }
          });

        if (queueError) {
          console.error(`[check-stalled-orders] Error queueing message:`, queueError);
          
          // Atualizar status do alerta
          await supabase
            .from('phase_stall_alerts')
            .update({ status: 'failed' })
            .eq('id', alert.id);
        } else {
          console.log(`[check-stalled-orders] Message queued for ${whatsapp}`);
          
          // Atualizar status do alerta
          await supabase
            .from('phase_stall_alerts')
            .update({ 
              status: 'sent',
              notification_sent: true 
            })
            .eq('id', alert.id);

          notificationsSent.push({
            orderId: order.id,
            managerId: managerToNotify.user_id,
            whatsapp
          });
        }
      }
    }

    // Resolver alertas antigos de pedidos que avançaram
    const { error: resolveError } = await supabase
      .from('phase_stall_alerts')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .in('status', ['pending', 'sent'])
      .lt('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (resolveError) {
      console.error('[check-stalled-orders] Error resolving old alerts:', resolveError);
    }

    console.log(`[check-stalled-orders] Completed. Alerts created: ${alertsCreated.length}, Notifications sent: ${notificationsSent.length}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        orders_checked: activeOrders?.length || 0,
        phases_with_alerts: phaseConfigs?.length || 0,
        alerts_created: alertsCreated.length,
        notifications_sent: notificationsSent.length
      },
      alerts: alertsCreated,
      notifications: notificationsSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[check-stalled-orders] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertConfig {
  type: string;
  enabled: boolean;
  threshold?: number;
  priority: 1 | 2 | 3;
}

const DEFAULT_ALERTS: AlertConfig[] = [
  { type: 'delayed_orders', enabled: true, priority: 1 },
  { type: 'critical_sla', enabled: true, threshold: 24, priority: 1 }, // 24h
  { type: 'large_order', enabled: true, threshold: 50000, priority: 2 },
  { type: 'bottleneck', enabled: true, threshold: 5, priority: 2 }, // 5+ pedidos travados
  { type: 'pending_material', enabled: true, threshold: 3, priority: 2 }, // 3+ dias
  { type: 'expired_quote', enabled: true, threshold: 48, priority: 3 }, // 48h
  { type: 'negative_trend', enabled: true, threshold: 20, priority: 3 }, // 20% queda
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Starting smart alerts analysis...');

    const today = new Date();
    const alerts: Array<{ type: string; priority: number; message: string; metadata: Record<string, any> }> = [];

    // 1. PEDIDOS ATRASADOS (Prioridade Crítica)
    const { data: delayedOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total_value, delivery_date, status')
      .not('status', 'in', '("completed","cancelled","delivered")')
      .lt('delivery_date', today.toISOString().split('T')[0])
      .order('total_value', { ascending: false })
      .limit(10);

    if (delayedOrders && delayedOrders.length > 0) {
      const totalValue = delayedOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);
      
      let message = `🚨 *ALERTA: ${delayedOrders.length} PEDIDOS ATRASADOS*
━━━━━━━━━━━━━━━━━━
💰 Valor em risco: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

*Top 5 por valor:*`;

      delayedOrders.slice(0, 5).forEach((o, i) => {
        const daysLate = Math.ceil((today.getTime() - new Date(o.delivery_date).getTime()) / (1000 * 60 * 60 * 24));
        message += `\n${i + 1}. #${o.order_number} - ${o.customer_name.substring(0, 20)}
   ⏱️ ${daysLate} dias | 💰 R$ ${Number(o.total_value || 0).toLocaleString('pt-BR')}`;
      });

      message += `\n\n⚠️ _Ação imediata necessária!_`;

      alerts.push({
        type: 'delayed_orders',
        priority: 1,
        message,
        metadata: { count: delayedOrders.length, totalValue },
      });
    }

    // 2. SLA CRÍTICO (Vence em 24h)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const { data: criticalOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total_value, delivery_date, status')
      .not('status', 'in', '("completed","cancelled","delivered")')
      .gte('delivery_date', today.toISOString().split('T')[0])
      .lte('delivery_date', tomorrow.toISOString().split('T')[0])
      .order('total_value', { ascending: false })
      .limit(10);

    if (criticalOrders && criticalOrders.length >= 3) {
      const totalValue = criticalOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);
      
      let message = `⚠️ *ALERTA: ${criticalOrders.length} PEDIDOS VENCEM EM 24H*
━━━━━━━━━━━━━━━━━━
💰 Valor: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

*Pedidos críticos:*`;

      criticalOrders.slice(0, 5).forEach((o, i) => {
        message += `\n${i + 1}. #${o.order_number} - ${o.customer_name.substring(0, 20)}
   📍 ${o.status}`;
      });

      message += `\n\n🔔 _Priorizar estes pedidos hoje!_`;

      alerts.push({
        type: 'critical_sla',
        priority: 1,
        message,
        metadata: { count: criticalOrders.length, totalValue },
      });
    }

    // 3. GARGALO DETECTADO
    const phaseThresholds: Record<string, { limit: number; statuses: string[] }> = {
      'Produção': { limit: 7, statuses: ['in_production', 'separation_started', 'awaiting_material'] },
      'Faturamento': { limit: 2, statuses: ['invoice_requested', 'awaiting_invoice'] },
      'Laboratório': { limit: 3, statuses: ['awaiting_lab', 'in_lab_analysis'] },
      'Expedição': { limit: 2, statuses: ['released_for_shipping', 'in_expedition', 'awaiting_pickup'] },
    };

    for (const [phase, config] of Object.entries(phaseThresholds)) {
      const { data: phaseOrders } = await supabase
        .from('orders')
        .select('id, order_number, updated_at')
        .in('status', config.statuses);

      if (phaseOrders) {
        const stuckOrders = phaseOrders.filter(o => {
          const daysInPhase = Math.ceil((today.getTime() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          return daysInPhase > config.limit;
        });

        if (stuckOrders.length >= 5) {
          const message = `🔧 *GARGALO: ${phase.toUpperCase()}*
━━━━━━━━━━━━━━━━━━
⚠️ ${stuckOrders.length} pedidos travados há mais de ${config.limit} dias

*Pedidos afetados:*
${stuckOrders.slice(0, 5).map(o => `• #${o.order_number}`).join('\n')}

🛠️ _Verificar capacidade e recursos!_`;

          alerts.push({
            type: 'bottleneck',
            priority: 2,
            message,
            metadata: { phase, count: stuckOrders.length, threshold: config.limit },
          });
        }
      }
    }

    // 4. MATERIAL PENDENTE > 3 DIAS
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const { data: materialOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, updated_at')
      .eq('status', 'awaiting_material')
      .lt('updated_at', threeDaysAgo.toISOString())
      .limit(10);

    if (materialOrders && materialOrders.length >= 3) {
      let message = `📦 *ALERTA: MATERIAL PENDENTE*
━━━━━━━━━━━━━━━━━━
⚠️ ${materialOrders.length} pedidos aguardando material há +3 dias

*Pedidos:*`;

      materialOrders.slice(0, 5).forEach((o) => {
        const days = Math.ceil((today.getTime() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        message += `\n• #${o.order_number} - ${days} dias aguardando`;
      });

      message += `\n\n📞 _Contatar fornecedores!_`;

      alerts.push({
        type: 'pending_material',
        priority: 2,
        message,
        metadata: { count: materialOrders.length },
      });
    }

    // 5. COTAÇÕES EXPIRADAS
    const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000);
    const { data: expiredQuotes } = await supabase
      .from('freight_quotes')
      .select('id, orders(order_number, customer_name)')
      .eq('status', 'pending')
      .lt('created_at', twoDaysAgo.toISOString())
      .limit(10);

    if (expiredQuotes && expiredQuotes.length >= 3) {
      let message = `💰 *ALERTA: COTAÇÕES SEM RESPOSTA*
━━━━━━━━━━━━━━━━━━
⏰ ${expiredQuotes.length} cotações pendentes há +48h

*Pedidos afetados:*`;

      expiredQuotes.slice(0, 5).forEach((q: any) => {
        message += `\n• #${q.orders?.order_number || 'N/A'}`;
      });

      message += `\n\n📧 _Cobrar transportadoras!_`;

      alerts.push({
        type: 'expired_quote',
        priority: 3,
        message,
        metadata: { count: expiredQuotes.length },
      });
    }

    // 6. TENDÊNCIA NEGATIVA (Comparativo semanal)
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const { data: thisWeekDelivered } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'delivered')
      .gte('updated_at', lastWeek.toISOString());

    const { data: lastWeekDelivered } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'delivered')
      .gte('updated_at', twoWeeksAgo.toISOString())
      .lt('updated_at', lastWeek.toISOString());

    const thisWeekCount = thisWeekDelivered?.length || 0;
    const lastWeekCount = lastWeekDelivered?.length || 0;

    if (lastWeekCount > 0) {
      const changePercent = Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);
      
      if (changePercent <= -20) {
        const message = `📉 *ALERTA: QUEDA NA PRODUTIVIDADE*
━━━━━━━━━━━━━━━━━━
⚠️ Entregas caíram ${Math.abs(changePercent)}% vs semana anterior

📊 *Comparativo:*
• Esta semana: ${thisWeekCount} entregas
• Semana anterior: ${lastWeekCount} entregas
• Variação: ${changePercent}%

🔍 _Investigar causas da queda!_`;

        alerts.push({
          type: 'negative_trend',
          priority: 3,
          message,
          metadata: { thisWeek: thisWeekCount, lastWeek: lastWeekCount, changePercent },
        });
      }
    }

    // ===================== NOVOS ALERTAS DE ITENS =====================

    // 7. ITENS COM SLA VENCIDO
    const { data: overdueItems } = await supabase
      .from('order_items')
      .select(`
        id, item_code, item_description, sla_deadline, current_phase,
        unit_price, total_value, requested_quantity,
        orders(order_number, customer_name)
      `)
      .lt('sla_deadline', today.toISOString().split('T')[0])
      .not('item_status', 'in', '("completed","delivered","cancelled")')
      .limit(20);

    if (overdueItems && overdueItems.length >= 5) {
      let totalItemValue = 0;
      
      let message = `📦 *ALERTA: ${overdueItems.length} ITENS COM SLA VENCIDO*
━━━━━━━━━━━━━━━━━━

*Itens críticos:*`;

      overdueItems.slice(0, 5).forEach((item: any) => {
        const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
        totalItemValue += Number(itemValue);
        const slaDate = new Date(item.sla_deadline);
        const daysLate = Math.ceil((today.getTime() - slaDate.getTime()) / (1000 * 60 * 60 * 24));
        
        message += `\n• ${item.item_code} - #${item.orders?.order_number || 'N/A'}
   ⏱️ ${daysLate}d atrasado | Fase: ${item.current_phase || 'N/A'}`;
      });

      if (overdueItems.length > 5) {
        message += `\n... e mais ${overdueItems.length - 5} itens`;
      }

      message += `\n\n💰 Valor em risco: R$ ${totalItemValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
⚠️ _Priorizar itens com SLA vencido!_`;

      alerts.push({
        type: 'overdue_items',
        priority: 1,
        message,
        metadata: { count: overdueItems.length, totalValue: totalItemValue },
      });
    }

    // 8. ITENS PARADOS NA MESMA FASE > 5 DIAS
    const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);
    const { data: allItems } = await supabase
      .from('order_items')
      .select(`
        id, item_code, current_phase, phase_started_at, created_at,
        orders(order_number)
      `)
      .not('item_status', 'in', '("completed","delivered","cancelled")')
      .limit(100);

    // Filtrar itens parados há mais de 5 dias
    const stuckItems = (allItems || []).filter((item: any) => {
      const phaseStarted = item.phase_started_at ? new Date(item.phase_started_at) : new Date(item.created_at);
      return phaseStarted < fiveDaysAgo;
    });

    if (stuckItems.length >= 5) {
      // Agrupar por fase
      const byPhase: Record<string, any[]> = {};
      stuckItems.forEach((item: any) => {
        const phase = item.current_phase || 'Indefinido';
        if (!byPhase[phase]) byPhase[phase] = [];
        byPhase[phase].push(item);
      });

      let message = `⏰ *ALERTA: ${stuckItems.length} ITENS PARADOS (>5 dias)*
━━━━━━━━━━━━━━━━━━

*Por fase:*`;

      Object.entries(byPhase)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 4)
        .forEach(([phase, items]) => {
          const emoji = phase.includes('Produção') ? '🔧' : 
                        phase.includes('Lab') ? '🔬' : 
                        phase.includes('Embalagem') ? '📦' : '📋';
          message += `\n\n${emoji} *${phase}:* ${items.length} itens`;
          items.slice(0, 2).forEach((item: any) => {
            const phaseStarted = item.phase_started_at ? new Date(item.phase_started_at) : new Date(item.created_at);
            const daysStuck = Math.ceil((today.getTime() - phaseStarted.getTime()) / (1000 * 60 * 60 * 24));
            message += `\n   • ${item.item_code} - #${item.orders?.order_number || 'N/A'} (${daysStuck}d)`;
          });
        });

      message += `\n\n🔍 _Verificar gargalos operacionais!_`;

      alerts.push({
        type: 'stuck_items',
        priority: 2,
        message,
        metadata: { count: stuckItems.length, phases: Object.keys(byPhase).length },
      });
    }

    // ===================== FIM NOVOS ALERTAS =====================

    // Se não há alertas
    if (alerts.length === 0) {
      console.log('✅ No alerts to send');
      return new Response(
        JSON.stringify({ success: true, message: 'No alerts generated', alerts: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Generated ${alerts.length} alert(s)`);

    // Buscar gestores ativos
    const { data: managers } = await supabase
      .from('management_report_recipients')
      .select('whatsapp, user_id, profiles:user_id(full_name)')
      .eq('is_active', true);

    if (!managers || managers.length === 0) {
      console.log('⚠️ No active managers found');
      return new Response(
        JSON.stringify({ success: true, message: 'No managers to notify', alerts: alerts.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar alertas para a fila (ordenados por prioridade)
    alerts.sort((a, b) => a.priority - b.priority);

    let queuedCount = 0;
    for (const alert of alerts) {
      for (let i = 0; i < managers.length; i++) {
        const manager = managers[i];
        
        await supabase.from('message_queue').insert({
          recipient_whatsapp: manager.whatsapp,
          recipient_name: (manager as any).profiles?.full_name || null,
          message_type: `smart_alert_${alert.type}`,
          message_content: alert.message,
          priority: alert.priority,
          status: 'pending',
          // Escalonar: 5 segundos entre destinatários, 30 segundos entre alertas
          scheduled_for: new Date(Date.now() + (queuedCount * 5000) + (alerts.indexOf(alert) * 30000)).toISOString(),
          metadata: alert.metadata,
        });
        queuedCount++;
      }
    }

    // Enviar alertas também para Discord (em paralelo, não bloqueia WhatsApp)
    // Alertas de prioridade 1 são marcados como "emergency_alert" para tratamento especial
    for (const alert of alerts) {
      try {
        const isEmergency = alert.priority === 1;
        const notificationType = isEmergency ? 'emergency_alert' : 'smart_alert';
        
        await supabase.functions.invoke('discord-notify', {
          body: {
            notificationType,
            priority: alert.priority,
            title: alert.type.replace(/_/g, ' ').toUpperCase(),
            message: alert.message,
            alertType: alert.type,  // Tipo específico do alerta
            metadata: alert.metadata,
          }
        });
        console.log(`📤 Discord: Sent ${alert.type} as ${notificationType} (priority ${alert.priority})`);
      } catch (discordErr) {
        console.error(`❌ Discord error for ${alert.type}:`, discordErr);
        // Não falhar a função se Discord falhar
      }
    }

    console.log(`✅ Queued ${queuedCount} alert messages for ${managers.length} manager(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        alertsGenerated: alerts.length,
        messagesQueued: queuedCount,
        managers: managers.length,
        alertTypes: alerts.map(a => a.type),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in manager-smart-alerts:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

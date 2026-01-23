import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface NotifyRequest {
  notificationType: 
    | 'smart_alert' 
    | 'emergency_alert'    // Alertas críticos de prioridade 1
    | 'status_change' 
    | 'phase_notification' 
    | 'purchase_alert'
    | 'ai_customer_notification'
    | 'ai_handoff'
    | 'freight_quote'
    | 'delivery_confirmation'
    | 'daily_report';
  priority: 1 | 2 | 3;
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  phase?: string;
  alertType?: string;  // Tipo específico do alerta (delayed_orders, critical_sla, etc.)
  metadata?: Record<string, any>;
  organizationId?: string;
}

// Cores por prioridade (Discord usa formato decimal)
const PRIORITY_COLORS: Record<number, number> = {
  1: 0xFF0000,  // Vermelho - Crítico
  2: 0xFFA500,  // Laranja - Alto
  3: 0x00FF00,  // Verde - Normal
};

// Emojis por tipo de notificação
const TYPE_EMOJIS: Record<string, string> = {
  smart_alert: '🚨',
  emergency_alert: '🆘',
  status_change: '📋',
  phase_notification: '📍',
  purchase_alert: '🛒',
  ai_customer_notification: '📱',
  ai_handoff: '🙋',
  freight_quote: '🚚',
  delivery_confirmation: '📦',
  daily_report: '📊',
};

// Emojis específicos por tipo de alerta
const ALERT_TYPE_EMOJIS: Record<string, string> = {
  delayed_orders: '⏰',
  critical_sla: '⚠️',
  overdue_items: '📦',
  bottleneck: '🔧',
  pending_material: '📦',
  stuck_items: '⏳',
  expired_quote: '💰',
  negative_trend: '📉',
};

// Converter markdown WhatsApp para Discord
function convertMarkdown(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, '**$1**')
    .replace(/_([^_]+)_/g, '*$1*')
    .replace(/━+/g, '───────────────');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: NotifyRequest = await req.json();
    console.log(`📬 Discord notify: ${body.notificationType} - ${body.title}`);

    // Mapear tipo de notificação para coluna de filtro
    const typeFilter: Record<string, string> = {
      smart_alert: 'receive_smart_alerts',
      emergency_alert: 'receive_smart_alerts',  // Emergenciais usam mesmo campo
      status_change: 'receive_status_changes',
      phase_notification: 'receive_phase_notifications',
      purchase_alert: 'receive_purchase_alerts',
      ai_customer_notification: 'receive_ai_customer_notifications',
      ai_handoff: 'receive_ai_handoff_alerts',
      freight_quote: 'receive_freight_quotes',
      delivery_confirmation: 'receive_delivery_confirmations',
      daily_report: 'receive_daily_reports',
    };

    // Buscar webhooks ativos
    let query = supabase
      .from('discord_webhooks')
      .select('*')
      .eq('is_active', true)
      .lte('min_priority', body.priority);

    if (body.organizationId) {
      query = query.eq('organization_id', body.organizationId);
    }

    const { data: webhooks, error: webhookError } = await query;

    if (webhookError) {
      console.error('Error fetching webhooks:', webhookError);
      return new Response(JSON.stringify({ success: false, error: webhookError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('No active Discord webhooks found');
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No webhooks configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filtrar webhooks que aceitam este tipo de notificação
    const filterColumn = typeFilter[body.notificationType];
    let eligibleWebhooks = webhooks.filter(w => w[filterColumn] === true);

    // Aplicar filtros avançados
    eligibleWebhooks = eligibleWebhooks.filter(w => {
      // Filtro por fase
      if (w.filter_phases?.length > 0 && body.phase) {
        if (!w.filter_phases.includes(body.phase)) return false;
      }
      
      // Filtro por valor mínimo
      if (w.filter_min_order_value && body.metadata?.orderValue) {
        if (body.metadata.orderValue < w.filter_min_order_value) return false;
      }
      
      // Filtro por cliente
      if (w.filter_customers?.length > 0 && body.metadata?.customerName) {
        const customerMatch = w.filter_customers.some((c: string) => 
          body.metadata!.customerName.toLowerCase().includes(c.toLowerCase())
        );
        if (!customerMatch) return false;
      }
      
      // Filtro por tipo de pedido
      if (w.filter_order_types?.length > 0 && body.metadata?.orderType) {
        if (!w.filter_order_types.includes(body.metadata.orderType)) return false;
      }
      
      return true;
    });

    if (eligibleWebhooks.length === 0) {
      console.log(`No webhooks configured to receive ${body.notificationType}`);
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No eligible webhooks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Separar webhooks com digest habilitado (exceto prioridade crítica)
    const digestWebhooks = eligibleWebhooks.filter(w => w.enable_digest && body.priority !== 1);
    const immediateWebhooks = eligibleWebhooks.filter(w => !w.enable_digest || body.priority === 1);

    // Adicionar à fila de digest
    if (digestWebhooks.length > 0) {
      const now = new Date();
      
      for (const webhook of digestWebhooks) {
        const intervalMinutes = webhook.digest_interval_minutes || 15;
        const scheduledFor = new Date(Math.ceil(now.getTime() / (intervalMinutes * 60 * 1000)) * (intervalMinutes * 60 * 1000));
        
        // Verificar se já existe item na fila para este webhook/tipo
        const { data: existing } = await supabase
          .from('discord_digest_queue')
          .select('id, notifications')
          .eq('webhook_id', webhook.id)
          .eq('notification_type', body.notificationType)
          .is('processed_at', null)
          .gte('scheduled_for', now.toISOString())
          .limit(1)
          .single();
        
        const newNotification = {
          type: body.notificationType,
          title: body.title,
          message: body.message.substring(0, 200),
          priority: body.priority,
          orderNumber: body.orderNumber,
          timestamp: now.toISOString(),
        };
        
        if (existing) {
          // Adicionar ao existente
          const notifications = [...(existing.notifications || []), newNotification];
          await supabase
            .from('discord_digest_queue')
            .update({ notifications })
            .eq('id', existing.id);
        } else {
          // Criar novo
          await supabase
            .from('discord_digest_queue')
            .insert({
              organization_id: body.organizationId,
              webhook_id: webhook.id,
              notification_type: body.notificationType,
              notifications: [newNotification],
              scheduled_for: scheduledFor.toISOString(),
            });
        }
      }
      
      console.log(`📋 Added to digest queue for ${digestWebhooks.length} webhook(s)`);
    }

    if (immediateWebhooks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        sent: 0, 
        queued: digestWebhooks.length,
        message: 'All notifications queued for digest' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${immediateWebhooks.length} immediate webhook(s)`);

    // Determinar emoji apropriado
    const alertEmoji = body.alertType && ALERT_TYPE_EMOJIS[body.alertType] 
      ? ALERT_TYPE_EMOJIS[body.alertType] 
      : TYPE_EMOJIS[body.notificationType] || '📢';
    
    // Adicionar prefixo EMERGENCIAL para alertas críticos
    const titlePrefix = body.notificationType === 'emergency_alert' ? '🆘 EMERGENCIAL: ' : '';

    // Construir embed do Discord
    const embed: DiscordEmbed = {
      title: `${alertEmoji} ${titlePrefix}${body.title}`,
      description: convertMarkdown(body.message),
      color: PRIORITY_COLORS[body.priority] || PRIORITY_COLORS[3],
      fields: [],
      timestamp: new Date().toISOString(),
    };

    // Adicionar campos extras
    if (body.orderNumber) {
      embed.fields!.push({ name: '📦 Pedido', value: `#${body.orderNumber}`, inline: true });
    }
    if (body.phase) {
      const phaseLabels: Record<string, string> = {
        purchases: 'Compras',
        production_client: 'Produção Cliente',
        production_stock: 'Produção Estoque',
        laboratory: 'Laboratório',
        freight_quote: 'Cotação Frete',
        logistics: 'Expedição',
      };
      embed.fields!.push({ name: '📍 Fase', value: phaseLabels[body.phase] || body.phase, inline: true });
    }
    if (body.metadata?.count) {
      embed.fields!.push({ name: '📊 Quantidade', value: String(body.metadata.count), inline: true });
    }
    if (body.metadata?.totalValue) {
      const formatted = new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(body.metadata.totalValue);
      embed.fields!.push({ name: '💰 Valor', value: formatted, inline: true });
    }

    embed.footer = { text: 'OrderHub • Sistema de Gestão' };

    // Enviar para cada webhook
    let sentCount = 0;
    const results: Array<{ channel: string; success: boolean; error?: string }> = [];

    for (const webhook of immediateWebhooks) {
      try {
        // Construir menção de role se habilitado
        let content = '';
        if (webhook.enable_role_mentions) {
          if (body.priority === 1 && webhook.role_mention_critical) {
            content = `<@&${webhook.role_mention_critical}> `;
          } else if (body.priority === 2 && webhook.role_mention_high) {
            content = `<@&${webhook.role_mention_high}> `;
          }
        }

        const payload: { embeds: DiscordEmbed[]; content?: string } = { embeds: [embed] };
        if (content) {
          payload.content = content;
        }

        // Verificar se deve usar thread
        let targetUrl = webhook.webhook_url;
        
        if (webhook.enable_auto_threads && body.orderId && webhook.discord_bot_token) {
          // Buscar thread existente para este pedido
          const { data: existingThread } = await supabase
            .from('discord_order_threads')
            .select('thread_id')
            .eq('order_id', body.orderId)
            .eq('webhook_id', webhook.id)
            .limit(1)
            .single();
          
          if (existingThread?.thread_id) {
            // Enviar na thread existente via Bot API
            const botResponse = await fetch(`https://discord.com/api/v10/channels/${existingThread.thread_id}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${webhook.discord_bot_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });
            
            if (botResponse.ok) {
              sentCount++;
              await supabase
                .from('discord_order_threads')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', existingThread.thread_id);
              
              results.push({ channel: webhook.channel_name, success: true });
              continue;
            }
          }
        }

        // Envio normal via webhook
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const responseText = response.ok ? null : await response.text();
        const success = response.ok;

        // Log da notificação
        await supabase.from('discord_notification_log').insert({
          organization_id: body.organizationId,
          webhook_id: webhook.id,
          notification_type: body.notificationType,
          message_content: embed,
          order_id: body.orderId || null,
          status: success ? 'sent' : 'failed',
          error_message: success ? null : responseText,
          sent_at: success ? new Date().toISOString() : null,
        });

        if (success) {
          sentCount++;
          console.log(`✅ Sent to ${webhook.channel_name}`);
        } else {
          console.error(`❌ Failed to send to ${webhook.channel_name}: ${responseText}`);
        }

        results.push({
          channel: webhook.channel_name,
          success,
          error: responseText || undefined,
        });
      } catch (err: any) {
        console.error(`Failed to send to ${webhook.channel_name}:`, err);
        
        await supabase.from('discord_notification_log').insert({
          organization_id: body.organizationId,
          webhook_id: webhook.id,
          notification_type: body.notificationType,
          message_content: embed,
          order_id: body.orderId || null,
          status: 'failed',
          error_message: err.message,
        });

        results.push({
          channel: webhook.channel_name,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`📤 Sent ${sentCount}/${immediateWebhooks.length} Discord notification(s), queued ${digestWebhooks.length}`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      total: immediateWebhooks.length,
      queued: digestWebhooks.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Discord notify error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

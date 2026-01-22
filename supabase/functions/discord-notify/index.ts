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
    | 'status_change' 
    | 'phase_notification' 
    | 'purchase_alert'
    // Novos tipos para IA
    | 'ai_customer_notification'  // Notificação enviada ao cliente
    | 'ai_handoff'                // Handoff para humano
    | 'freight_quote'             // Cotação de frete enviada
    | 'delivery_confirmation'     // Confirmação de entrega
    | 'daily_report';             // Relatório diário enviado
  priority: 1 | 2 | 3;
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  phase?: string;
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
  status_change: '📋',
  phase_notification: '📍',
  purchase_alert: '🛒',
  // Novos tipos IA
  ai_customer_notification: '📱',
  ai_handoff: '🙋',
  freight_quote: '🚚',
  delivery_confirmation: '📦',
  daily_report: '📊',
};

// Converter markdown WhatsApp para Discord
function convertMarkdown(text: string): string {
  // WhatsApp usa *bold* e _italic_, Discord usa **bold** e *italic*
  // Também remover caracteres de formatação excessivos
  return text
    .replace(/\*([^*]+)\*/g, '**$1**')  // *texto* -> **texto**
    .replace(/_([^_]+)_/g, '*$1*')      // _texto_ -> *texto*
    .replace(/━+/g, '───────────────'); // Simplificar linhas
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
      status_change: 'receive_status_changes',
      phase_notification: 'receive_phase_notifications',
      purchase_alert: 'receive_purchase_alerts',
      // Novos tipos IA
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
    const eligibleWebhooks = webhooks.filter(w => w[filterColumn] === true);

    if (eligibleWebhooks.length === 0) {
      console.log(`No webhooks configured to receive ${body.notificationType}`);
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No eligible webhooks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${eligibleWebhooks.length} eligible webhook(s)`);

    // Construir embed do Discord
    const embed: DiscordEmbed = {
      title: `${TYPE_EMOJIS[body.notificationType] || '📢'} ${body.title}`,
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

    for (const webhook of eligibleWebhooks) {
      try {
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
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

    console.log(`📤 Sent ${sentCount}/${eligibleWebhooks.length} Discord notification(s)`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      total: eligibleWebhooks.length,
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

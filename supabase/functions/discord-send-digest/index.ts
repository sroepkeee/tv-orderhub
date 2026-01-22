import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DigestItem {
  type: string;
  title: string;
  message: string;
  priority: number;
  orderNumber?: string;
  timestamp: string;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

// Cores por prioridade
const PRIORITY_COLORS: Record<number, number> = {
  1: 0xFF0000,  // Vermelho - Crítico
  2: 0xFFA500,  // Laranja - Alto
  3: 0x00FF00,  // Verde - Normal
};

const TYPE_LABELS: Record<string, string> = {
  smart_alert: 'Alerta Inteligente',
  status_change: 'Mudança de Status',
  phase_notification: 'Mudança de Fase',
  purchase_alert: 'Compras',
  ai_customer_notification: 'Notificação IA',
  ai_handoff: 'Handoff Humano',
  freight_quote: 'Cotação Frete',
  delivery_confirmation: 'Confirmação Entrega',
  daily_report: 'Relatório',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('📬 Processing Discord digest queue...');

    // Buscar itens pendentes agrupados por webhook
    const { data: pendingItems, error: fetchError } = await supabase
      .from('discord_digest_queue')
      .select(`
        id,
        organization_id,
        webhook_id,
        notification_type,
        notifications,
        scheduled_for,
        discord_webhooks!inner (
          webhook_url,
          channel_name,
          is_active
        )
      `)
      .is('processed_at', null)
      .lte('scheduled_for', new Date().toISOString())
      .eq('discord_webhooks.is_active', true)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching digest queue:', fetchError);
      return new Response(JSON.stringify({ success: false, error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log('No pending digest items');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${pendingItems.length} pending digest items`);

    // Agrupar por webhook_id
    const groupedByWebhook = pendingItems.reduce((acc, item) => {
      if (!acc[item.webhook_id]) {
        acc[item.webhook_id] = {
          webhook: item.discord_webhooks,
          items: [],
          ids: [],
        };
      }
      acc[item.webhook_id].items.push(...(item.notifications || []));
      acc[item.webhook_id].ids.push(item.id);
      return acc;
    }, {} as Record<string, { webhook: any; items: DigestItem[]; ids: string[] }>);

    let sentCount = 0;
    const processedIds: string[] = [];

    for (const [webhookId, group] of Object.entries(groupedByWebhook)) {
      if (group.items.length === 0) continue;

      // Agrupar por tipo
      const byType = group.items.reduce((acc, item: any) => {
        const type = item.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      // Determinar prioridade máxima
      const maxPriority = Math.min(...group.items.map((i: any) => i.priority || 3));

      // Construir embed de resumo
      const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
      
      for (const [type, items] of Object.entries(byType)) {
        const label = TYPE_LABELS[type] || type;
        const count = items.length;
        
        // Mostrar até 3 itens de preview
        const preview = items.slice(0, 3)
          .map((i: any) => `• ${i.title || i.message?.substring(0, 50)}`)
          .join('\n');
        
        fields.push({
          name: `${label} (${count})`,
          value: preview + (count > 3 ? `\n_...e mais ${count - 3}_` : ''),
          inline: false,
        });
      }

      const embed: DiscordEmbed = {
        title: `📊 Resumo de Notificações (${group.items.length})`,
        description: `**Período:** Últimos ${15} minutos\n**Prioridade máxima:** ${maxPriority === 1 ? '🔴 Crítico' : maxPriority === 2 ? '🟠 Alto' : '🟢 Normal'}`,
        color: PRIORITY_COLORS[maxPriority] || PRIORITY_COLORS[3],
        fields,
        footer: { text: 'OrderHub • Digest System' },
        timestamp: new Date().toISOString(),
      };

      try {
        const response = await fetch(group.webhook.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });

        if (response.ok) {
          sentCount++;
          processedIds.push(...group.ids);
          console.log(`✅ Sent digest to ${group.webhook.channel_name} (${group.items.length} items)`);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to send digest: ${errorText}`);
        }
      } catch (err: any) {
        console.error(`Failed to send digest:`, err);
      }
    }

    // Marcar como processados
    if (processedIds.length > 0) {
      await supabase
        .from('discord_digest_queue')
        .update({ processed_at: new Date().toISOString() })
        .in('id', processedIds);
    }

    console.log(`📤 Processed ${sentCount} digest(s), marked ${processedIds.length} items`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedIds.length,
      sent: sentCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Discord digest error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

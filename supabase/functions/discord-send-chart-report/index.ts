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
  image?: { url: string };
}

const COLORS = {
  success: 0x00FF00,
  warning: 0xFFA500,
  error: 0xFF0000,
  info: 0x5865F2,
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

    const body = await req.json();
    const { reportType = 'sla', organizationId } = body;

    console.log(`📊 Generating Discord chart report: ${reportType}`);

    // Buscar webhooks que aceitam relatórios visuais
    let query = supabase
      .from('discord_webhooks')
      .select('*')
      .eq('is_active', true)
      .eq('receive_visual_reports', true);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: webhooks, error: webhookError } = await query;

    if (webhookError || !webhooks?.length) {
      console.log('No webhooks configured for visual reports');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular métricas
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);

    // Buscar pedidos ativos
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, status, delivery_date, total_value, created_at')
      .not('status', 'in', '(completed,cancelled,delivered)');

    // Calcular distribuição por fase
    const phaseDistribution: Record<string, number> = {};
    let onTime = 0, overdue = 0, critical = 0;

    (activeOrders || []).forEach((o: any) => {
      // Contagem por fase
      const phase = o.status || 'unknown';
      phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;

      // SLA
      if (o.delivery_date) {
        const delivery = new Date(o.delivery_date);
        const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) overdue++;
        else if (diffDays <= 2) critical++;
        else onTime++;
      }
    });

    const total = onTime + overdue + critical;
    const slaRate = total > 0 ? Math.round((onTime / total) * 100) : 0;

    // Gerar gráfico usando a função generate-chart existente
    let chartUrl = '';
    
    try {
      // Preparar dados para gráfico de pizza (distribuição por status)
      const chartLabels = Object.keys(phaseDistribution).slice(0, 6);
      const chartValues = chartLabels.map(k => phaseDistribution[k]);
      
      const chartConfig = {
        type: 'pie',
        data: {
          labels: chartLabels.map(l => l.replace(/_/g, ' ')),
          datasets: [{
            data: chartValues,
            backgroundColor: [
              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
            ]
          }]
        },
        options: {
          title: {
            display: true,
            text: 'Distribuição por Fase'
          }
        }
      };

      // Usar QuickChart diretamente
      const quickchartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=300&bkg=white`;
      chartUrl = quickchartUrl;
      
    } catch (chartError) {
      console.error('Error generating chart:', chartError);
    }

    // Construir embed
    const embed: DiscordEmbed = {
      title: `📈 Relatório Visual - ${reportType === 'sla' ? 'SLA Semanal' : 'Distribuição'}`,
      description: `**Período:** Últimos 7 dias\n**Total de Pedidos Ativos:** ${activeOrders?.length || 0}`,
      color: slaRate >= 90 ? COLORS.success : slaRate >= 70 ? COLORS.warning : COLORS.error,
      fields: [
        { name: '✅ No Prazo', value: String(onTime), inline: true },
        { name: '⚠️ Críticos (≤2 dias)', value: String(critical), inline: true },
        { name: '🔴 Atrasados', value: String(overdue), inline: true },
        { name: '📊 Taxa de SLA', value: `${slaRate}%`, inline: true },
      ],
      footer: { text: 'OrderHub • Relatório Visual Automático' },
      timestamp: new Date().toISOString(),
    };

    // Adicionar imagem do gráfico se disponível
    if (chartUrl) {
      embed.image = { url: chartUrl };
    }

    // Enviar para cada webhook
    let sentCount = 0;

    for (const webhook of webhooks) {
      try {
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });

        if (response.ok) {
          sentCount++;
          console.log(`✅ Sent chart report to ${webhook.channel_name}`);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed: ${errorText}`);
        }
      } catch (err: any) {
        console.error(`Failed to send to ${webhook.channel_name}:`, err);
      }
    }

    console.log(`📤 Sent ${sentCount}/${webhooks.length} chart report(s)`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      total: webhooks.length,
      metrics: { slaRate, onTime, critical, overdue },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Discord chart report error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

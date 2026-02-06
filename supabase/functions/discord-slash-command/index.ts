import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as hex from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature-ed25519, x-signature-timestamp',
};

// Verificar assinatura do Discord (Ed25519)
async function verifyDiscordSignature(
  signature: string | null,
  timestamp: string | null,
  body: string,
  publicKey: string | null
): Promise<boolean> {
  if (!signature || !timestamp || !publicKey) {
    console.log('Missing signature, timestamp, or public key');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const message = encoder.encode(timestamp + body);
    
    // Importar chave pública
    const keyData = hex.decode(new TextEncoder().encode(publicKey));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );
    
    // Decodificar assinatura
    const signatureData = hex.decode(new TextEncoder().encode(signature));
    
    // Verificar
    const isValid = await crypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureData,
      message
    );
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

interface DiscordInteraction {
  type: number;
  data?: {
    name: string;
    options?: Array<{ name: string; value: string | number }>;
  };
  token: string;
  application_id: string;
  guild_id?: string;
  channel_id?: string;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

// Cores
const COLORS = {
  success: 0x00FF00,
  warning: 0xFFA500,
  error: 0xFF0000,
  info: 0x5865F2,
};

// Status labels
const STATUS_LABELS: Record<string, string> = {
  in_production: 'Em Produção',
  awaiting_material: 'Aguardando Material',
  ready_for_shipping: 'Pronto para Envio',
  in_transit: 'Em Trânsito',
  delivered: 'Entregue',
  completed: 'Concluído',
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

    // Ler body como texto para verificação de assinatura
    const bodyText = await req.text();
    
    // Verificar assinatura do Discord (em produção)
    const discordPublicKey = Deno.env.get('DISCORD_PUBLIC_KEY');
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');
    
    // Se temos chave pública configurada, verificar assinatura
    if (discordPublicKey) {
      const isValid = await verifyDiscordSignature(signature, timestamp, bodyText, discordPublicKey);
      if (!isValid) {
        console.error('discord-slash-command: Invalid signature');
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
    } else {
      console.warn('discord-slash-command: DISCORD_PUBLIC_KEY not configured - signature verification skipped');
    }
    
    const body: DiscordInteraction = JSON.parse(bodyText);
    console.log(`📨 Discord interaction: type=${body.type}`);

    // Tipo 1: PING (verificação do Discord)
    if (body.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Tipo 2: APPLICATION_COMMAND
    if (body.type === 2 && body.data) {
      const command = body.data.name;
      const options = body.data.options || [];
      
      console.log(`🎮 Command: /${command}`, options);

      let response: { type: number; data: { embeds?: DiscordEmbed[]; content?: string; flags?: number } };

      switch (command) {
        case 'pedido': {
          const orderNumber = options.find(o => o.name === 'numero')?.value as string;
          
          if (!orderNumber) {
            response = {
              type: 4,
              data: {
                content: '❌ Por favor, informe o número do pedido.',
                flags: 64, // Ephemeral
              }
            };
            break;
          }

          const { data: order, error } = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              customer_name,
              status,
              delivery_date,
              total_value,
              created_at,
              order_items (count)
            `)
            .ilike('order_number', `%${orderNumber}%`)
            .limit(1)
            .single();

          if (error || !order) {
            response = {
              type: 4,
              data: {
                content: `❌ Pedido "${orderNumber}" não encontrado.`,
                flags: 64,
              }
            };
            break;
          }

          const statusLabel = STATUS_LABELS[order.status] || order.status;
          const deliveryDate = order.delivery_date 
            ? new Date(order.delivery_date).toLocaleDateString('pt-BR')
            : 'Não definida';

          const embed: DiscordEmbed = {
            title: `📦 Pedido #${order.order_number}`,
            description: `**Cliente:** ${order.customer_name || 'N/A'}`,
            color: COLORS.info,
            fields: [
              { name: '📋 Status', value: statusLabel, inline: true },
              { name: '📅 Entrega', value: deliveryDate, inline: true },
              { name: '📦 Itens', value: String(order.order_items?.[0]?.count || 0), inline: true },
            ],
            footer: { text: 'OrderHub • Consulta de Pedido' },
            timestamp: new Date().toISOString(),
          };

          if (order.total_value) {
            embed.fields!.push({
              name: '💰 Valor',
              value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_value),
              inline: true,
            });
          }

          response = {
            type: 4,
            data: { embeds: [embed] }
          };
          break;
        }

        case 'ativos': {
          const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .not('status', 'in', '(completed,cancelled,delivered)');

          if (error) {
            response = {
              type: 4,
              data: { content: '❌ Erro ao consultar pedidos ativos.', flags: 64 }
            };
            break;
          }

          // Buscar distribuição por fase
          const { data: byPhase } = await supabase
            .from('orders')
            .select('status')
            .not('status', 'in', '(completed,cancelled,delivered)');

          const phaseCount: Record<string, number> = {};
          (byPhase || []).forEach((o: any) => {
            const phase = o.status || 'unknown';
            phaseCount[phase] = (phaseCount[phase] || 0) + 1;
          });

          const phaseFields = Object.entries(phaseCount)
            .slice(0, 6)
            .map(([status, cnt]) => ({
              name: STATUS_LABELS[status] || status,
              value: String(cnt),
              inline: true,
            }));

          const embed: DiscordEmbed = {
            title: `📊 Pedidos Ativos: ${count}`,
            description: 'Distribuição por status:',
            color: COLORS.info,
            fields: phaseFields,
            footer: { text: 'OrderHub • Métricas' },
            timestamp: new Date().toISOString(),
          };

          response = {
            type: 4,
            data: { embeds: [embed] }
          };
          break;
        }

        case 'sla': {
          // Calcular métricas de SLA
          const today = new Date();
          const { data: orders } = await supabase
            .from('orders')
            .select('id, delivery_date, status, created_at')
            .not('status', 'in', '(completed,cancelled,delivered)');

          let onTime = 0;
          let overdue = 0;
          let critical = 0;

          (orders || []).forEach((o: any) => {
            if (!o.delivery_date) return;
            const delivery = new Date(o.delivery_date);
            const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) overdue++;
            else if (diffDays <= 2) critical++;
            else onTime++;
          });

          const total = onTime + overdue + critical;
          const slaRate = total > 0 ? ((onTime / total) * 100).toFixed(1) : '0';

          const embed: DiscordEmbed = {
            title: `📈 Métricas de SLA`,
            description: `Taxa de cumprimento: **${slaRate}%**`,
            color: parseFloat(slaRate) >= 90 ? COLORS.success : parseFloat(slaRate) >= 70 ? COLORS.warning : COLORS.error,
            fields: [
              { name: '✅ No Prazo', value: String(onTime), inline: true },
              { name: '⚠️ Críticos', value: String(critical), inline: true },
              { name: '🔴 Atrasados', value: String(overdue), inline: true },
            ],
            footer: { text: 'OrderHub • SLA Dashboard' },
            timestamp: new Date().toISOString(),
          };

          response = {
            type: 4,
            data: { embeds: [embed] }
          };
          break;
        }

        case 'fase': {
          const phaseName = options.find(o => o.name === 'nome')?.value as string;
          
          if (!phaseName) {
            response = {
              type: 4,
              data: { content: '❌ Por favor, informe o nome da fase.', flags: 64 }
            };
            break;
          }

          // Mapear nome para status
          const phaseMapping: Record<string, string[]> = {
            producao: ['in_production', 'separation_started', 'production_completed'],
            laboratorio: ['awaiting_lab', 'in_lab_analysis', 'lab_completed'],
            expedicao: ['released_for_shipping', 'in_expedition', 'awaiting_pickup'],
            compras: ['purchase_pending', 'purchase_in_progress', 'purchase_completed'],
          };

          const normalizedPhase = phaseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const statuses = phaseMapping[normalizedPhase] || [phaseName];

          const { data: orders, count } = await supabase
            .from('orders')
            .select('order_number, customer_name, delivery_date', { count: 'exact' })
            .in('status', statuses)
            .order('delivery_date', { ascending: true })
            .limit(5);

          const orderList = (orders || [])
            .map((o: any) => `• **#${o.order_number}** - ${o.customer_name || 'N/A'}`)
            .join('\n') || 'Nenhum pedido encontrado';

          const embed: DiscordEmbed = {
            title: `📍 Fase: ${phaseName} (${count || 0})`,
            description: orderList,
            color: COLORS.info,
            footer: { text: 'OrderHub • Consulta por Fase' },
            timestamp: new Date().toISOString(),
          };

          response = {
            type: 4,
            data: { embeds: [embed] }
          };
          break;
        }

        default:
          response = {
            type: 4,
            data: { content: `❓ Comando desconhecido: /${command}`, flags: 64 }
          };
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ type: 1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Discord slash command error:', error);
    return new Response(JSON.stringify({ 
      type: 4, 
      data: { content: `❌ Erro: ${error.message}`, flags: 64 } 
    }), {
      status: 200, // Discord espera 200 mesmo em erro
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

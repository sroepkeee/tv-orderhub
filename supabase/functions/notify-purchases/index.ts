import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseNotificationRequest {
  purchaseRequestId?: string;
  orderId?: string;
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  items: Array<{
    itemCode: string;
    itemDescription: string;
    requestedQuantity: number;
    unit: string;
    warehouse: string;
  }>;
  movedBy: string;
  notes?: string;
  // RATEIO fields
  businessUnit?: string;
  costCenter?: string;
  accountItem?: string;
  businessArea?: string;
  senderCompany?: string;
}

// Simple HTML escaper to prevent XSS in email bodies
function escapeHtml(str: string): string {
  if (!str) return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: PurchaseNotificationRequest = await req.json();
    
    console.log("📧 [notify-purchases] Recebendo requisição:", {
      purchaseRequestId: payload.purchaseRequestId,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      itemsCount: payload.items?.length || 0,
    });

    if (!payload.items || payload.items.length === 0) {
      console.log("⚠️ [notify-purchases] Nenhum item para compra, ignorando notificação");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum item para compra" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar data de entrega
    const deliveryDateFormatted = new Date(payload.deliveryDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Calcular dias até a entrega
    const today = new Date();
    const deliveryDate = new Date(payload.deliveryDate);
    const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const urgencyClass = daysUntilDelivery <= 3 ? 'color: #dc2626; font-weight: bold;' : 
                         daysUntilDelivery <= 7 ? 'color: #f59e0b; font-weight: bold;' : 
                         'color: #22c55e;';

    // Gerar linhas da tabela de itens (com escape HTML)
    const itemsRows = payload.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: 600;">
          ${escapeHtml(item.itemCode)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${escapeHtml(item.itemDescription)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${escapeHtml(String(item.requestedQuantity))} ${escapeHtml(item.unit)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${escapeHtml(item.warehouse || '-')}
        </td>
      </tr>
    `).join('');

    // Seção de observações se houver
    const notesSection = payload.notes ? `
      <!-- Notes Section -->
      <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #fcd34d;">
        <h2 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px;">
          📝 Observações Importantes
        </h2>
        <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${escapeHtml(payload.notes || '')}</p>
      </div>
    ` : '';

    // Template HTML do e-mail
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
        🛒 ${payload.purchaseRequestId ? 'Solicitação de Compra' : 'Novo Pedido para Compras'}
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
        Sistema de Gestão de Pedidos - IMPLY
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      
      <!-- Alert Box -->
      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #f97316; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #9a3412; font-size: 14px;">
          <strong>⚡ Ação Necessária:</strong> ${payload.purchaseRequestId 
            ? 'Uma solicitação de compra foi enviada para aprovação.' 
            : 'Um pedido foi movido para a fase de Compras e contém itens que precisam ser adquiridos.'}
        </p>
      </div>
      
      ${notesSection}
      
      <!-- Order Info Card -->
      <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
          📋 Informações ${payload.purchaseRequestId ? 'da Solicitação' : 'do Pedido'}
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">${payload.purchaseRequestId ? 'Nº da OC:' : 'Nº do Pedido:'}</td>
             <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 16px;">#${escapeHtml(payload.orderNumber)}</td>
           </tr>
           <tr>
             <td style="padding: 8px 0; color: #6b7280;">${payload.purchaseRequestId ? 'Empresa:' : 'Cliente:'}</td>
             <td style="padding: 8px 0; color: #111827; font-weight: 500;">${escapeHtml(payload.customerName)}</td>
           </tr>
           <tr>
             <td style="padding: 8px 0; color: #6b7280;">Data de Entrega:</td>
             <td style="padding: 8px 0; font-weight: 500; ${urgencyClass}">
               ${deliveryDateFormatted}
               ${daysUntilDelivery <= 7 ? `<span style="font-size: 12px;"> (${daysUntilDelivery} dias)</span>` : ''}
             </td>
           </tr>
           <tr>
             <td style="padding: 8px 0; color: #6b7280;">${payload.purchaseRequestId ? 'Solicitado por:' : 'Movido por:'}</td>
             <td style="padding: 8px 0; color: #111827;">${escapeHtml(payload.movedBy)}</td>
           </tr>
        </table>
      </div>
      
      <!-- RATEIO Info Card -->
      ${payload.businessUnit || payload.costCenter || payload.accountItem || payload.businessArea || payload.senderCompany ? `
      <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #fcd34d;">
        <h2 style="margin: 0 0 16px 0; color: #92400e; font-size: 18px; border-bottom: 2px solid #fcd34d; padding-bottom: 12px;">
          💰 Informações de RATEIO
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${payload.senderCompany ? `
          <tr>
            <td style="padding: 8px 0; color: #92400e; width: 160px;">Empresa Emissora:</td>
            <td style="padding: 8px 0; color: #78350f; font-weight: 600;">${payload.senderCompany}</td>
          </tr>` : ''}
          ${payload.businessUnit ? `
          <tr>
            <td style="padding: 8px 0; color: #92400e;">BU (Business Unit):</td>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">${payload.businessUnit}</td>
          </tr>` : ''}
          ${payload.costCenter ? `
          <tr>
            <td style="padding: 8px 0; color: #92400e;">Centro de Custo:</td>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">${payload.costCenter}</td>
          </tr>` : ''}
          ${payload.accountItem ? `
          <tr>
            <td style="padding: 8px 0; color: #92400e;">Projeto / Item Conta:</td>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">${payload.accountItem}</td>
          </tr>` : ''}
          ${payload.businessArea ? `
          <tr>
            <td style="padding: 8px 0; color: #92400e;">Área de Negócio:</td>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; ${
                payload.businessArea === 'ssm' ? 'background-color: #dbeafe; color: #1e40af;' :
                payload.businessArea === 'filial' ? 'background-color: #dcfce7; color: #166534;' :
                payload.businessArea === 'projetos' ? 'background-color: #f3e8ff; color: #7c3aed;' :
                payload.businessArea === 'ecommerce' ? 'background-color: #ffedd5; color: #c2410c;' :
                'background-color: #f3f4f6; color: #374151;'
              }">
                ${payload.businessArea === 'ssm' ? 'SSM (Manutenção)' :
                  payload.businessArea === 'filial' ? 'Filial' :
                  payload.businessArea === 'projetos' ? 'Projetos' :
                  payload.businessArea === 'ecommerce' ? 'E-commerce' :
                  payload.businessArea || '-'}
              </span>
            </td>
          </tr>` : ''}
        </table>
      </div>
      ` : ''}
      
      <!-- Items Table -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">
          📦 Itens para Compra (${payload.items.length})
        </h2>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background-color: #f97316; color: #ffffff;">
                <th style="padding: 14px 12px; text-align: left; font-weight: 600;">Código</th>
                <th style="padding: 14px 12px; text-align: left; font-weight: 600;">Descrição</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600;">Quantidade</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600;">Armazém</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://imply-pedidos.lovable.app/compras" 
           style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.25);">
          Abrir Módulo de Compras →
        </a>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="background-color: #1f2937; padding: 24px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Este é um e-mail automático enviado pelo Sistema de Gestão de Pedidos IMPLY.
      </p>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 11px;">
        © ${new Date().getFullYear()} IMPLY Tecnologia Eletrônica LTDA.
      </p>
    </div>
    
  </div>
</body>
</html>
    `;

    // Enviar e-mail para compras e SSM
    const recipients = ["compras@imply.com", "ssm@imply.com"];
    const emailResponse = await resend.emails.send({
      from: "Sistema de Pedidos <onboarding@resend.dev>",
      to: recipients,
      subject: `🛒 ${payload.purchaseRequestId ? 'Solicitação de Compra' : 'Pedido'} #${payload.orderNumber} - ${payload.items.length} itens`,
      html: htmlContent,
    });

    console.log("✅ [notify-purchases] E-mail enviado com sucesso:", emailResponse);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Se tiver purchaseRequestId, atualizar campos de notificação
      if (payload.purchaseRequestId) {
        const { error: updateError } = await supabase
          .from('purchase_requests')
          .update({
            notification_sent_at: new Date().toISOString(),
            notification_recipients: recipients,
            notification_count: supabase.rpc('increment_notification_count', { request_id: payload.purchaseRequestId })
          })
          .eq('id', payload.purchaseRequestId);

        if (updateError) {
          console.error("⚠️ [notify-purchases] Erro ao atualizar purchase_request:", updateError);
          // Tentar incremento manual
          const { data: currentRequest } = await supabase
            .from('purchase_requests')
            .select('notification_count')
            .eq('id', payload.purchaseRequestId)
            .single();
          
          await supabase
            .from('purchase_requests')
            .update({
              notification_sent_at: new Date().toISOString(),
              notification_recipients: recipients,
              notification_count: (currentRequest?.notification_count || 0) + 1
            })
            .eq('id', payload.purchaseRequestId);
        }
      }
      
      // Registrar log no banco
      await supabase.from('ai_notification_log').insert({
        channel: 'email',
        recipient: recipients.join(', '),
        order_id: payload.orderId || null,
        message_content: `Notificação de compras: ${payload.purchaseRequestId ? 'Solicitação' : 'Pedido'} #${payload.orderNumber} com ${payload.items.length} itens`,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          type: 'purchase_notification',
          purchase_request_id: payload.purchaseRequestId,
          recipients: recipients,
          items_count: payload.items.length,
          moved_by: payload.movedBy,
          delivery_date: payload.deliveryDate,
          notes: payload.notes,
          rateio: {
            business_unit: payload.businessUnit,
            cost_center: payload.costCenter,
            account_item: payload.accountItem,
            business_area: payload.businessArea,
            sender_company: payload.senderCompany
          }
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        recipients: recipients,
        sentAt: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ [notify-purchases] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

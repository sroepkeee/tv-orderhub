import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  customer_name: string;
  customer_document?: string;
  email: string;
  nf_count: number;
  organization_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const { customer_name, customer_document, email, nf_count, organization_id }: InviteRequest = await req.json();

    console.log("Sending invite to:", { customer_name, email, nf_count });

    // Gerar token único
    const invite_token = crypto.randomUUID();

    // Criar registro do convite
    const { data: invite, error: insertError } = await supabaseClient
      .from("technician_invites")
      .insert({
        customer_name,
        customer_document,
        email,
        invite_token,
        organization_id,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invite:", insertError);
      throw new Error(`Erro ao criar convite: ${insertError.message}`);
    }

    // Construir link de cadastro
    const baseUrl = "https://wejkyyjhckdlttieuyku.lovableproject.com";
    const encodedName = encodeURIComponent(customer_name);
    const encodedDoc = customer_document ? encodeURIComponent(customer_document) : "";
    const encodedToken = encodeURIComponent(invite_token);
    
    const registrationLink = `${baseUrl}/auth?type=technician&name=${encodedName}&doc=${encodedDoc}&token=${encodedToken}`;

    // Enviar email via Resend API diretamente
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Imply <noreply@resend.dev>",
        to: [email],
        subject: `Acesso ao Portal de Remessas - ${nf_count} NF(s) em seu nome`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .info-box { background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Portal de Remessas</h1>
              </div>
              <div class="content">
                <h2>Olá, ${customer_name}!</h2>
                
                <p>Você possui <strong>${nf_count} Nota(s) Fiscal(is)</strong> de remessa para conserto/garantia em seu nome.</p>
                
                <div class="info-box">
                  <strong>Com o portal você pode:</strong>
                  <ul>
                    <li>Visualizar todas as NFs em seu poder</li>
                    <li>Acompanhar o status dos equipamentos</li>
                    <li>Solicitar retorno de materiais</li>
                  </ul>
                </div>
                
                <p style="text-align: center;">
                  <a href="${registrationLink}" class="button">Criar Meu Acesso</a>
                </p>
                
                <p style="font-size: 14px; color: #666;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br>
                  <a href="${registrationLink}" style="word-break: break-all;">${registrationLink}</a>
                </p>
              </div>
              <div class="footer">
                <p>Este é um email automático, não responda.</p>
                <p>© Imply Tecnologia</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(`Erro ao enviar email: ${emailResult.message || 'Erro desconhecido'}`);
    }

    // Atualizar registro com data de envio
    await supabaseClient
      .from("technician_invites")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, invite_id: invite.id, email_id: emailResult.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-technician-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

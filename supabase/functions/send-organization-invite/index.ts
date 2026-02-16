import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  name?: string;
  whatsapp?: string;
  role: string;
  sendViaEmail: boolean;
  sendViaWhatsApp: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const megaApiUrl = Deno.env.get('MEGA_API_URL');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN');
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Usuário sem organização' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    if (!['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Apenas admins podem convidar usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: InviteRequest = await req.json();
    const { email, name, whatsapp, role, sendViaEmail, sendViaWhatsApp } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if invite already exists for this email
    const { data: existingInvite } = await supabaseAdmin
      .from('organization_invites')
      .select('id, status')
      .eq('organization_id', membership.organization_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: 'Já existe um convite pendente para este email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user already exists in organization
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', membership.organization_id)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMember) {
        return new Response(JSON.stringify({ error: 'Este usuário já faz parte da organização' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('organization_invites')
      .insert({
        organization_id: membership.organization_id,
        email: email.toLowerCase(),
        name,
        whatsapp,
        role: role || 'member',
        invited_by: user.id,
        sent_via_email: sendViaEmail,
        sent_via_whatsapp: sendViaWhatsApp && !!whatsapp,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return new Response(JSON.stringify({ error: 'Erro ao criar convite' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgName = (membership.organizations as any)?.name || 'V.I.V.O.';
    const inviteUrl = `${req.headers.get('origin') || 'https://tv-orderhub.lovable.app'}/auth?type=invite&token=${invite.invite_token}`;

    // Send email via Resend
    let emailSent = false;
    let emailError: string | null = null;
    if (sendViaEmail && resendApiKey) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'V.I.V.O. <onboarding@resend.dev>',
            to: [email],
            subject: `Convite para participar de ${orgName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Olá${name ? ` ${name}` : ''}!</h2>
                <p>Você foi convidado para participar da organização <strong>${orgName}</strong> na plataforma V.I.V.O.</p>
                <p>Clique no botão abaixo para criar sua conta:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Criar minha conta
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">Este convite expira em 7 dias.</p>
                <p style="color: #666; font-size: 14px;">Se você não solicitou este convite, pode ignorar este email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">V.I.V.O. - Controle Operacional Inteligente</p>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
          console.log('Email sent successfully to:', email);
        } else {
          const errorBody = await emailResponse.text();
          emailError = `Resend API error (${emailResponse.status}): ${errorBody}`;
          console.error('Error sending email:', emailError);
        }
      } catch (err) {
        emailError = `Email send exception: ${err.message}`;
        console.error('Error sending email:', err);
      }
    } else if (sendViaEmail && !resendApiKey) {
      emailError = 'RESEND_API_KEY não configurada';
      console.error(emailError);
    }

    // Send WhatsApp via Mega API
    let whatsappSent = false;
    let whatsappErrorMsg: string | null = null;
    if (sendViaWhatsApp && whatsapp && megaApiUrl && megaApiToken && megaApiInstance) {
      try {
        const normalizedPhone = whatsapp.replace(/\D/g, '');
        const whatsappMessage = `Olá${name ? ` ${name}` : ''}! 👋\n\nVocê foi convidado para participar de *${orgName}* no sistema V.I.V.O.\n\nCrie sua conta aqui:\n${inviteUrl}\n\n_Válido por 7 dias._`;

        const whatsappResponse = await fetch(`${megaApiUrl}/message/sendText/${megaApiInstance}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${megaApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: normalizedPhone,
            text: whatsappMessage,
          }),
        });

        if (whatsappResponse.ok) {
          whatsappSent = true;
          console.log('WhatsApp sent successfully to:', normalizedPhone);
        } else {
          whatsappErrorMsg = await whatsappResponse.text();
          console.error('Error sending WhatsApp:', whatsappErrorMsg);
        }
      } catch (err) {
        whatsappErrorMsg = err.message;
        console.error('Error sending WhatsApp:', err);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invite: { 
        id: invite.id, 
        email: invite.email,
        invite_url: inviteUrl 
      },
      delivery: {
        email_sent: emailSent,
        email_error: emailError,
        whatsapp_sent: whatsappSent,
        whatsapp_error: whatsappErrorMsg,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-organization-invite:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
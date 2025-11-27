import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário está autorizado a usar WhatsApp
    const { data: authData, error: authError } = await supabaseClient
      .from('whatsapp_authorized_users')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (authError || !authData) {
      console.error('User not authorized for WhatsApp:', authError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autorizado para WhatsApp' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const megaApiUrl = Deno.env.get('MEGA_API_URL');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN');
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE');

    if (!megaApiUrl || !megaApiToken || !megaApiInstance) {
      console.error('Missing Mega API configuration');
      return new Response(
        JSON.stringify({ error: 'Configuração da API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching QR Code from Mega API for instance: ${megaApiInstance}`);

    // Chamar endpoint de QR Code da Mega API
    const qrResponse = await fetch(`${megaApiUrl}/rest/instance/qrcode/${megaApiInstance}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${megaApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.error('Mega API QR Code error:', qrResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao obter QR Code',
          details: errorText,
          status: qrResponse.status
        }),
        { status: qrResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qrData = await qrResponse.json();
    console.log('QR Code fetched successfully');

    return new Response(
      JSON.stringify({
        success: true,
        qrcode: qrData.qrcode || qrData.qr_code_image_url || qrData.base64,
        expiresIn: 60, // QR codes geralmente expiram em 60 segundos
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mega-api-qrcode:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

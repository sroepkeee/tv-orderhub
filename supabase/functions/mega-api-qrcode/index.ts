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

    // Verificar se o usuário está autorizado (whitelist ou admin)
    const { data: authData } = await supabaseClient
      .from('whatsapp_authorized_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    // Se não está na whitelist, verificar se é admin
    if (!authData) {
      const { data: adminRole } = await supabaseClient
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        console.error('User not authorized for WhatsApp - not in whitelist and not admin');
        return new Response(
          JSON.stringify({ error: 'Usuário não autorizado para WhatsApp' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('User authorized via admin role');
    } else {
      console.log('User authorized via whitelist');
    }

    let megaApiUrl = Deno.env.get('MEGA_API_URL');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN');
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE');

    if (!megaApiUrl || !megaApiToken || !megaApiInstance) {
      console.error('Missing Mega API configuration');
      return new Response(
        JSON.stringify({ error: 'Configuração da API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Garantir que a URL tenha protocolo https
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    
    // Remover barra final
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');

    console.log('Fetching QR Code from Mega API for instance:', megaApiInstance);
    console.log('Base URL:', megaApiUrl);

    // Lista de endpoints para tentar (diferentes versões da API)
    const endpoints = [
      `/rest/instance/qrcode/${megaApiInstance}`,
      `/instance/qrcode/${megaApiInstance}`,
      `/rest/qrcode/${megaApiInstance}`,
    ];

    let lastError = null;
    let qrResponse = null;
    let qrData = null;

    // Tentar cada endpoint até encontrar um que funcione
    for (const endpoint of endpoints) {
      const qrUrl = `${megaApiUrl}${endpoint}`;
      console.log('Trying QR endpoint:', qrUrl);

      try {
        qrResponse = await fetch(qrUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${megaApiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (qrResponse.ok) {
          qrData = await qrResponse.json();
          console.log('QR Code fetched successfully from endpoint:', endpoint);
          break;
        } else if (qrResponse.status === 404) {
          console.log('QR endpoint not found (404):', endpoint);
          lastError = `Endpoint not found: ${endpoint}`;
        } else {
          const errorText = await qrResponse.text();
          console.log('QR endpoint failed:', endpoint, 'Status:', qrResponse.status, 'Error:', errorText);
          lastError = errorText;
        }
      } catch (fetchError) {
        console.log('Fetch error for QR endpoint:', endpoint, 'Error:', fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      }
    }

    // Se conseguiu QR Code, retornar
    if (qrData) {
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: qrData.qrcode || qrData.qr_code_image_url || qrData.base64 || qrData.qr,
          expiresIn: 60, // QR codes geralmente expiram em 60 segundos
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se nenhum endpoint funcionou, retornar erro
    console.error('All QR endpoints failed. Last error:', lastError);
    return new Response(
      JSON.stringify({ 
        error: 'Não foi possível gerar QR Code',
        details: lastError,
        message: 'Todos os endpoints da API falharam. Verifique a configuração da Mega API.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mega-api-qrcode:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

    console.log('Fetching QR code from cache for instance:', megaApiInstance);

    // Buscar QR code do cache (salvo pelo webhook)
    const { data: instanceData, error: cacheError } = await supabaseClient
      .from('whatsapp_instances')
      .select('qrcode, qrcode_updated_at, status, phone_number')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();

    if (cacheError) {
      console.error('Error fetching from cache:', cacheError);
    }

    console.log('Cache data:', { 
      hasQrcode: !!instanceData?.qrcode, 
      status: instanceData?.status,
      updatedAt: instanceData?.qrcode_updated_at 
    });

    // Se instância está conectada
    if (instanceData?.status === 'connected') {
      console.log('Instance already connected');
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: null,
          status: 'connected',
          phoneNumber: instanceData.phone_number,
          message: 'Instância já está conectada',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Se tem QR code no cache e ainda está válido
    if (instanceData?.qrcode && instanceData?.qrcode_updated_at) {
      const updatedAt = new Date(instanceData.qrcode_updated_at);
      const now = new Date();
      const ageSeconds = (now.getTime() - updatedAt.getTime()) / 1000;
      
      // QR codes expiram em ~60 segundos
      if (ageSeconds < 60) {
        console.log('Returning cached QR code (age:', Math.floor(ageSeconds), 'seconds)');
        return new Response(
          JSON.stringify({
            success: true,
            qrcode: instanceData.qrcode,
            expiresIn: Math.max(0, 60 - Math.floor(ageSeconds)),
            status: 'available',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else {
        console.log('QR code expired (age:', Math.floor(ageSeconds), 'seconds)');
      }
    }

    // Aguardando QR code do webhook
    console.log('No valid QR code in cache, waiting for webhook');
    return new Response(
      JSON.stringify({
        success: true,
        qrcode: null,
        status: 'waiting',
        message: 'Aguardando QR Code do servidor... O webhook enviará em instantes.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mega-api-qrcode:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

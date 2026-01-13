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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE') ?? '';

    if (!megaApiUrl) {
      throw new Error('MEGA_API_URL not configured');
    }

    // Garantir que a URL tenha protocolo https
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    
    // Remover barra final
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');

    console.log('Checking connection status for instance:', megaApiInstance);
    console.log('Base URL:', megaApiUrl);

    // Buscar token do banco se disponível
    const { data: dbInstance } = await supabase
      .from('whatsapp_instances')
      .select('api_token')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();
    
    // Usar token do banco (prioridade) ou fallback para ENV
    const effectiveToken = dbInstance?.api_token || megaApiToken;

    // Lista de endpoints para tentar (diferentes versões da API)
    const endpoints = [
      `/rest/instance/connectionState/${megaApiInstance}`,
      `/instance/connectionState/${megaApiInstance}`,
    ];

    let lastError = null;
    let response = null;
    let data = null;

    // Tentar cada endpoint com timeout de 8 segundos
    for (const endpoint of endpoints) {
      const statusUrl = `${megaApiUrl}${endpoint}`;
      console.log('Trying endpoint:', statusUrl);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        // Usar formato apikey (padronizado)
        response = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'apikey': effectiveToken,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
          console.log('Success with endpoint:', endpoint);
          break;
        } else if (response.status === 404) {
          console.log('Endpoint not found (404):', endpoint);
          lastError = `Endpoint not found: ${endpoint}`;
        } else {
          console.log('Endpoint failed:', endpoint, 'Status:', response.status);
          lastError = `API returned status ${response.status}`;
        }
      } catch (fetchError) {
        console.log('Fetch error for endpoint:', endpoint, 'Error:', fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        // Don't continue if timeout - API is down
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log('Request timed out, skipping remaining endpoints');
          break;
        }
      }
    }

    // Buscar dados salvos da instância
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();

    // Se conseguiu dados da API, processar resposta
    if (data) {
      // Normalizar resposta (diferentes formatos possíveis)
      const state = data.state || data.status || data.instance?.state || 'unknown';
      const isConnected = state === 'open' || state === 'connected';

      return new Response(
        JSON.stringify({
          success: true,
          status: state,
          connected: isConnected || instanceData?.status === 'connected',
          instance: megaApiInstance,
          instanceKey: megaApiInstance,
          apiUrl: megaApiUrl,
          tokenConfigured: !!megaApiToken,
          phoneNumber: instanceData?.phone_number || data.phoneNumber,
          connectedAt: instanceData?.connected_at,
          instanceName: instanceData?.name,
          details: data,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Se não conseguiu dados da API mas tem dados salvos, usar eles
    if (instanceData) {
      return new Response(
        JSON.stringify({
          success: true,
          status: instanceData.status || 'unknown',
          connected: instanceData.status === 'connected',
          instance: megaApiInstance,
          instanceKey: megaApiInstance,
          apiUrl: megaApiUrl,
          tokenConfigured: !!megaApiToken,
          phoneNumber: instanceData.phone_number,
          connectedAt: instanceData.connected_at,
          instanceName: instanceData.name,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Se nenhum endpoint funcionou, retornar status desconhecido (não erro)
    // Isso permite que o usuário ainda tente gerar QR Code
    console.log('All endpoints failed. Last error:', lastError);
    
    return new Response(
      JSON.stringify({
        success: true,
        status: 'close',
        connected: false,
        instance: megaApiInstance,
        instanceKey: megaApiInstance,
        apiUrl: megaApiUrl,
        tokenConfigured: !!megaApiToken,
        message: 'Não foi possível verificar status. Tente gerar um novo QR Code para conectar.',
        error: lastError,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mega-api-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        connected: false,
        status: 'error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

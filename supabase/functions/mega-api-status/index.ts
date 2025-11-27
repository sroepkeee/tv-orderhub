const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Lista de endpoints para tentar (diferentes versões da API)
    const endpoints = [
      `/rest/instance/connectionState/${megaApiInstance}`,
      `/instance/connectionState/${megaApiInstance}`,
      `/rest/instance/fetchInstances/${megaApiInstance}`,
    ];

    let lastError = null;
    let response = null;
    let data = null;

    // Tentar cada endpoint até encontrar um que funcione
    for (const endpoint of endpoints) {
      const statusUrl = `${megaApiUrl}${endpoint}`;
      console.log('Trying endpoint:', statusUrl);

      try {
        response = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${megaApiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          data = await response.json();
          console.log('Success with endpoint:', endpoint, 'Data:', data);
          break;
        } else if (response.status === 404) {
          console.log('Endpoint not found (404):', endpoint);
          lastError = `Endpoint not found: ${endpoint}`;
        } else {
          const errorText = await response.text();
          console.log('Endpoint failed:', endpoint, 'Status:', response.status, 'Error:', errorText);
          lastError = errorText;
        }
      } catch (fetchError) {
        console.log('Fetch error for endpoint:', endpoint, 'Error:', fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      }
    }

    // Se conseguiu dados, processar resposta
    if (data) {
      // Normalizar resposta (diferentes formatos possíveis)
      const state = data.state || data.status || data.instance?.state || 'unknown';
      const isConnected = state === 'open' || state === 'connected';

      return new Response(
        JSON.stringify({
          success: true,
          status: state,
          connected: isConnected,
          instance: megaApiInstance,
          details: data,
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
        message: 'Não foi possível verificar status. Tente gerar um novo QR Code para conectar.',
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

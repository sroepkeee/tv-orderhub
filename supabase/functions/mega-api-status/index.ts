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

    // Garante que a URL tenha protocolo (https) para evitar erros "Invalid URL"
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }

    // Remove barras duplicadas no final ao montar a URL final
    const statusUrl = `${megaApiUrl.replace(/\/+$/, '')}/rest/instance/connectionState/${megaApiInstance}`;

    console.log('Checking connection status for instance:', megaApiInstance, 'using URL:', statusUrl);

    // Consultar status da conexão
    const response = await fetch(
      statusUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${megaApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mega API error:', errorText);
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Connection status:', data);

    // Normalizar resposta
    const status = data.state || data.status || 'unknown';
    const isConnected = status === 'open' || status === 'connected';

    return new Response(
      JSON.stringify({
        success: true,
        status: status,
        connected: isConnected,
        instance: megaApiInstance,
        details: data,
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

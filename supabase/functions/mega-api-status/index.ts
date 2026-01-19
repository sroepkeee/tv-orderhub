import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Verificar se token é placeholder
function isPlaceholderToken(token: string | null | undefined): boolean {
  if (!token || token.trim() === '') return true;
  const placeholders = ['SEU_TOKEN', 'API_KEY', 'YOUR_TOKEN', 'TOKEN_AQUI', 'PLACEHOLDER', 'XXX'];
  return placeholders.some(p => token.toUpperCase().includes(p));
}

// Try API call with multiple auth formats
async function tryApiCall(
  url: string,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
): Promise<{ success: boolean; data?: any; status?: number; error?: string }> {
  const authFormats = [
    { 'apikey': token },
    { 'Authorization': `Bearer ${token}` },
    { 'Apikey': token },
  ];

  for (const authHeader of authFormats) {
    try {
      const headerName = Object.keys(authHeader)[0];
      const headerValue = Object.values(authHeader)[0] as string;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      headers[headerName] = headerValue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        // Handle empty response
        if (!text || text.trim() === '') {
          console.log(`Empty response from ${url}`);
          return { success: true, data: {}, status: response.status };
        }
        try {
          const data = JSON.parse(text);
          console.log(`✅ API call success with ${headerName}:`, url);
          return { success: true, data, status: response.status };
        } catch (parseError) {
          console.log(`JSON parse error for ${url}:`, text.substring(0, 100));
          return { success: true, data: { raw: text }, status: response.status };
        }
      } else if (response.status === 401 || response.status === 403) {
        console.log(`Auth failed with ${headerName} (${response.status}), trying next...`);
        continue;
      } else {
        const errorText = await response.text().catch(() => '');
        console.log(`API failed: ${response.status} - ${errorText.substring(0, 100)}`);
        return { success: false, status: response.status, error: errorText };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Timeout' };
      }
      console.log(`Fetch error:`, error);
    }
  }

  return { success: false, error: 'All auth formats failed' };
}

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
      .select('api_token, status, phone_number, connected_at, name')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();
    
    // Obter token efetivo (banco ou env, ignorando placeholders)
    let effectiveToken = dbInstance?.api_token;
    if (isPlaceholderToken(effectiveToken)) {
      console.log('⚠️ Database token is placeholder, using MEGA_API_TOKEN from env');
      effectiveToken = megaApiToken;
    }
    
    if (isPlaceholderToken(effectiveToken)) {
      console.error('❌ No valid token available (db or env)');
    }

    // =========================================================================
    // MEGA API START v2 - ENDPOINTS DE STATUS
    // Documentação: https://doc.megaapi.com.br
    // =========================================================================
    
    const statusEndpoints = [
      // Mega API Start v2 - Endpoints principais
      `/rest/instance/fetchInstances`,
      `/rest/instance/connectionState/${megaApiInstance}`,
      `/rest/instance/info/${megaApiInstance}`,
      // Formatos alternativos
      `/instance/fetchInstances`,
      `/instance/connectionState/${megaApiInstance}`,
      `/instance/info/${megaApiInstance}`,
    ];

    let connectionState = null;
    let instanceInfo = null;
    let lastError = null;

    // Tentar cada endpoint
    for (const endpoint of statusEndpoints) {
      const url = `${megaApiUrl}${endpoint}`;
      console.log('Trying endpoint:', url);

      const result = await tryApiCall(url, effectiveToken || '');

      if (result.success && result.data) {
        console.log('✅ Success with endpoint:', endpoint);
        console.log('Response keys:', Object.keys(result.data));
        
        // fetchInstances retorna lista de instâncias
        if (endpoint.includes('fetchInstances')) {
          const instances = result.data.instances || result.data.data || result.data;
          if (Array.isArray(instances)) {
            instanceInfo = instances.find((inst: any) => 
              inst.instance === megaApiInstance || 
              inst.instanceKey === megaApiInstance ||
              inst.name === megaApiInstance
            );
            if (instanceInfo) {
              console.log('Found instance in list:', instanceInfo);
              connectionState = instanceInfo.state || instanceInfo.status || instanceInfo.connectionState;
            }
          }
        } else {
          // connectionState ou info retorna dados da instância específica
          instanceInfo = result.data;
          connectionState = result.data.state || result.data.status || 
                           result.data.connectionState || result.data.instance?.state;
        }

        if (connectionState) break;
      } else if (result.status === 404) {
        console.log('Endpoint not found (404):', endpoint);
        lastError = `Endpoint 404: ${endpoint}`;
      } else {
        lastError = result.error || `Status ${result.status}`;
      }
    }

    // Normalizar estado de conexão
    const normalizeState = (state: string | null | undefined): string => {
      if (!state) return 'unknown';
      const s = state.toLowerCase();
      if (s === 'open' || s === 'connected' || s === 'online') return 'connected';
      if (s === 'close' || s === 'disconnected' || s === 'offline') return 'disconnected';
      if (s === 'connecting' || s === 'waiting_scan' || s === 'qrcode') return 'waiting_scan';
      return s;
    };

    const normalizedState = normalizeState(connectionState);
    const isConnected = normalizedState === 'connected';

    // Atualizar status no banco se mudou
    if (connectionState && dbInstance) {
      const newStatus = normalizedState;
      if (newStatus !== dbInstance.status) {
        console.log(`Updating instance status: ${dbInstance.status} -> ${newStatus}`);
        await supabase.from('whatsapp_instances').update({
          status: newStatus,
          ...(isConnected && instanceInfo?.phoneNumber ? { phone_number: instanceInfo.phoneNumber } : {}),
          ...(isConnected && !dbInstance.connected_at ? { connected_at: new Date().toISOString() } : {}),
        }).eq('instance_key', megaApiInstance);
      }
    }

    // Retornar resultado
    if (connectionState || dbInstance) {
      return new Response(
        JSON.stringify({
          success: true,
          status: normalizedState || dbInstance?.status || 'unknown',
          connected: isConnected || dbInstance?.status === 'connected',
          instance: megaApiInstance,
          instanceKey: megaApiInstance,
          apiUrl: megaApiUrl,
          tokenConfigured: !!effectiveToken && !isPlaceholderToken(effectiveToken),
          phoneNumber: instanceInfo?.phoneNumber || dbInstance?.phone_number,
          connectedAt: dbInstance?.connected_at,
          instanceName: dbInstance?.name,
          details: instanceInfo,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fallback - nenhum endpoint funcionou
    console.log('All endpoints failed. Last error:', lastError);
    
    // Detectar se é problema de instância não encontrada
    const instanceNotFound = lastError?.includes('Instance not found') || lastError?.includes('NOT_FOUND');
    
    return new Response(
      JSON.stringify({
        success: true,
        status: instanceNotFound ? 'not_found' : 'unknown',
        connected: false,
        instance: megaApiInstance,
        instanceKey: megaApiInstance,
        apiUrl: megaApiUrl,
        tokenConfigured: !!effectiveToken && !isPlaceholderToken(effectiveToken),
        message: instanceNotFound 
          ? `A instância "${megaApiInstance}" não foi encontrada no painel da Mega API. Verifique se a instância existe e está ativa.`
          : 'Não foi possível verificar status. Tente gerar um novo QR Code para conectar.',
        error: lastError,
        help: {
          panelUrl: 'https://painel.megaapi.com.br',
          action: 'Verifique se a instância está criada e ativa no painel',
        },
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

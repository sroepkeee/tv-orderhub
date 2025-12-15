import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// QR Code validity period (3 minutes - WhatsApp QR codes typically last 2-3 minutes)
const QR_CODE_VALIDITY_SECONDS = 180;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize URL to ensure https protocol
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/+$/, '');
}

// Try multiple auth header formats
async function tryApiCall(
  baseUrl: string, 
  endpoint: string, 
  method: string, 
  token: string,
  body?: object
): Promise<{ success: boolean; data?: any; status?: number; error?: string }> {
  const authFormats = [
    { 'apikey': token },
    { 'Authorization': `Bearer ${token}` },
    { 'Apikey': token },
  ];

  for (const authHeader of authFormats) {
    try {
      const url = `${baseUrl}${endpoint}`;
      const headerName = Object.keys(authHeader)[0];
      const headerValue = Object.values(authHeader)[0] as string;
      console.log(`[API] ${method} ${url} with ${headerName}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      headers[headerName] = headerValue;
      
      const fetchOptions: RequestInit = {
        method,
        headers,
      };
      
      if (body && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, fetchOptions);
      console.log(`[API] Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          console.log('[API] Success, response keys:', Object.keys(data));
          return { success: true, data, status: response.status };
        } else {
          // Some endpoints return image data directly
          const text = await response.text();
          return { success: true, data: { raw: text }, status: response.status };
        }
      } else if (response.status === 401 || response.status === 403) {
        console.log(`[API] Auth failed with ${headerName}, trying next...`);
        continue;
      } else {
        const errorText = await response.text().catch(() => 'No error body');
        console.log(`[API] Failed: ${response.status} - ${errorText.substring(0, 200)}`);
        return { success: false, status: response.status, error: errorText };
      }
    } catch (error) {
      console.error(`[API] Network error:`, error);
    }
  }
  
  return { success: false, error: 'All auth formats failed' };
}

// Extract QR code from various response formats
function extractQrCode(data: any): string | null {
  if (!data) return null;
  
  // Direct fields
  const directFields = ['qrcode', 'base64', 'qr', 'qrCode', 'code', 'pairingCode', 'qrcode_url'];
  for (const field of directFields) {
    if (data[field] && typeof data[field] === 'string') {
      return data[field];
    }
  }
  
  // Nested in instance object
  if (data.instance) {
    const instance = Array.isArray(data.instance) ? data.instance[0] : data.instance;
    for (const field of directFields) {
      if (instance?.[field] && typeof instance[field] === 'string') {
        return instance[field];
      }
    }
  }
  
  // Nested in data object
  if (data.data) {
    const nestedData = Array.isArray(data.data) ? data.data[0] : data.data;
    for (const field of directFields) {
      if (nestedData?.[field] && typeof nestedData[field] === 'string') {
        return nestedData[field];
      }
    }
  }
  
  return null;
}

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

    // Authenticate user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[Auth] Error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check authorization (whitelist, admin, or AI agent admin)
    const { data: authData } = await supabaseClient
      .from('whatsapp_authorized_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!authData) {
      const { data: adminRole } = await supabaseClient
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        const { data: aiAgentAdmin } = await supabaseClient
          .from('ai_agent_admins')
          .select('id')
          .eq('email', user.email)
          .eq('is_active', true)
          .maybeSingle();

        if (!aiAgentAdmin) {
          console.error('[Auth] User not authorized for WhatsApp');
          return new Response(
            JSON.stringify({ error: 'Usuário não autorizado para WhatsApp' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('[Auth] Authorized via AI agent admin');
      } else {
        console.log('[Auth] Authorized via admin role');
      }
    } else {
      console.log('[Auth] Authorized via whitelist');
    }

    // Get Mega API configuration
    const megaApiUrl = normalizeUrl(Deno.env.get('MEGA_API_URL') ?? '');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE') ?? '';

    console.log('[Config] Mega API:', {
      url: megaApiUrl,
      instance: megaApiInstance,
      tokenLength: megaApiToken.length,
    });

    if (!megaApiUrl || !megaApiToken || !megaApiInstance) {
      console.error('[Config] Missing Mega API configuration');
      return new Response(
        JSON.stringify({ 
          error: 'Configuração da API incompleta',
          details: {
            hasUrl: !!megaApiUrl,
            hasToken: !!megaApiToken,
            hasInstance: !!megaApiInstance,
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first
    console.log('[Cache] Checking for instance:', megaApiInstance);
    const { data: instanceData, error: cacheError } = await supabaseClient
      .from('whatsapp_instances')
      .select('qrcode, qrcode_updated_at, status, phone_number')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();

    if (cacheError) {
      console.error('[Cache] Error:', cacheError);
    }

    console.log('[Cache] Data:', { 
      hasQrcode: !!instanceData?.qrcode, 
      status: instanceData?.status,
      updatedAt: instanceData?.qrcode_updated_at 
    });

    // If instance is connected
    if (instanceData?.status === 'connected') {
      console.log('[Status] Instance already connected');
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: null,
          status: 'connected',
          phoneNumber: instanceData.phone_number,
          message: 'Instância já está conectada',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if cached QR code is still valid
    if (instanceData?.qrcode && instanceData?.qrcode_updated_at) {
      const updatedAt = new Date(instanceData.qrcode_updated_at);
      const ageSeconds = (Date.now() - updatedAt.getTime()) / 1000;
      
      if (ageSeconds < QR_CODE_VALIDITY_SECONDS) {
        console.log('[Cache] Returning valid QR code, age:', Math.floor(ageSeconds), 's');
        return new Response(
          JSON.stringify({
            success: true,
            qrcode: instanceData.qrcode,
            expiresIn: Math.max(0, QR_CODE_VALIDITY_SECONDS - Math.floor(ageSeconds)),
            status: 'available',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      console.log('[Cache] QR code expired, age:', Math.floor(ageSeconds), 's');
    }

    // =========================================================================
    // MEGA API START - QR CODE GENERATION ENDPOINTS
    // =========================================================================
    
    console.log('[API] Attempting to fetch QR code from Mega API START');
    
    // Primary endpoints for Mega API START (based on documentation)
    const qrCodeEndpoints = [
      // Connect/QR endpoints
      { path: `/rest/instance/connect/${megaApiInstance}`, method: 'GET' },
      { path: `/rest/instance/qrcode/${megaApiInstance}`, method: 'GET' },
      { path: `/rest/qrcode/image/${megaApiInstance}`, method: 'GET' },
      // Alternative formats
      { path: `/instance/connect/${megaApiInstance}`, method: 'GET' },
      { path: `/instance/qrcode/${megaApiInstance}`, method: 'GET' },
      // POST variants
      { path: `/rest/instance/connect/${megaApiInstance}`, method: 'POST' },
      { path: `/instance/connect/${megaApiInstance}`, method: 'POST' },
    ];

    for (const { path, method } of qrCodeEndpoints) {
      const result = await tryApiCall(megaApiUrl, path, method, megaApiToken);
      
      if (result.success && result.data) {
        const qrcode = extractQrCode(result.data);
        
        if (qrcode) {
          console.log('[API] QR code found via:', path);
          
          // Save to cache
          await supabaseClient.from('whatsapp_instances').upsert({
            instance_key: megaApiInstance,
            qrcode: qrcode,
            qrcode_updated_at: new Date().toISOString(),
            status: 'waiting_scan',
          });
          
          return new Response(
            JSON.stringify({
              success: true,
              qrcode: qrcode,
              expiresIn: QR_CODE_VALIDITY_SECONDS,
              status: 'available',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        
        // Check if response indicates we need to wait
        if (result.data.status === 'waiting' || result.data.state === 'connecting') {
          console.log('[API] Instance is connecting, QR should arrive via webhook');
        }
      }
    }

    // =========================================================================
    // RESTART/RECONNECT - Force new QR code generation
    // =========================================================================
    
    console.log('[API] No QR via direct endpoints, attempting restart/reconnect');
    
    const restartEndpoints = [
      // Logout to force new QR
      { path: `/rest/instance/logout/${megaApiInstance}`, method: 'DELETE' },
      { path: `/rest/instance/logout/${megaApiInstance}`, method: 'POST' },
      // Restart instance
      { path: `/rest/instance/restart/${megaApiInstance}`, method: 'PUT' },
      { path: `/rest/instance/restart/${megaApiInstance}`, method: 'POST' },
      // Reconnect
      { path: `/rest/instance/reconnect/${megaApiInstance}`, method: 'POST' },
      { path: `/instance/restart/${megaApiInstance}`, method: 'POST' },
    ];

    let restartSuccess = false;
    for (const { path, method } of restartEndpoints) {
      const result = await tryApiCall(megaApiUrl, path, method, megaApiToken);
      
      if (result.success) {
        console.log('[API] Restart/reconnect successful via:', path);
        restartSuccess = true;
        
        // Update instance status
        await supabaseClient.from('whatsapp_instances').upsert({
          instance_key: megaApiInstance,
          status: 'reconnecting',
          qrcode: null,
          qrcode_updated_at: null,
        });
        
        break;
      }
    }

    if (restartSuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: null,
          status: 'waiting',
          message: 'Reconectando instância. QR Code será enviado em alguns segundos...',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // =========================================================================
    // FALLBACK - Return cached or waiting status
    // =========================================================================
    
    console.log('[Fallback] All API attempts failed');
    
    // Return cached QR code even if expired as last resort
    if (instanceData?.qrcode) {
      console.log('[Fallback] Returning cached QR code (may be expired)');
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: instanceData.qrcode,
          expiresIn: 0,
          status: 'available',
          warning: 'QR Code pode ter expirado. Tente escanear ou clique em "Gerar Novo" para solicitar outro.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Final fallback - waiting for webhook delivery
    return new Response(
      JSON.stringify({
        success: false,
        qrcode: null,
        status: 'error',
        message: 'Não foi possível gerar o QR Code. Verifique a configuração do webhook no painel Mega API.',
        webhookUrl: 'https://wejkyyjhckdlttieuyku.supabase.co/functions/v1/mega-api-webhook',
        requiredEvents: ['qrcode', 'connection.update', 'messages.upsert'],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Error] Unhandled:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized.replace(/\/+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const megaApiUrl = normalizeUrl(Deno.env.get('MEGA_API_URL') || 'https://apistart02.megaapi.com.br');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Restart instance requested');
    console.log('API URL:', megaApiUrl);
    console.log('Instance:', megaApiInstance);

    // Buscar instância conectada do banco
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    const instanceKey = instanceData?.instance_key || megaApiInstance;
    console.log('Using instance key:', instanceKey);

    // Endpoints para tentar reiniciar/desconectar
    const restartEndpoints = [
      { method: 'DELETE', path: `/rest/instance/logout/${instanceKey}` },
      { method: 'POST', path: `/rest/instance/restart/${instanceKey}` },
      { method: 'PUT', path: `/rest/instance/restart/${instanceKey}` },
      { method: 'POST', path: `/rest/instance/reconnect/${instanceKey}` },
      { method: 'DELETE', path: `/instance/logout/${instanceKey}` },
      { method: 'POST', path: `/instance/restart/${instanceKey}` },
    ];

    // Headers de autenticação a tentar
    const authHeaders: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
      { 'Apikey': megaApiToken },
    ];

    let apiSuccess = false;
    let lastError: string | null = null;

    // Tentar cada combinação de endpoint e header
    for (const endpoint of restartEndpoints) {
      if (apiSuccess) break;

      for (const authHeader of authHeaders) {
        try {
          const url = `${megaApiUrl}${endpoint.path}`;
          console.log(`Trying ${endpoint.method} ${url}`);

          const response = await fetch(url, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              ...authHeader,
            },
          });

          console.log(`Response status: ${response.status}`);

          if (response.ok || response.status === 200 || response.status === 201) {
            console.log('API restart successful!');
            apiSuccess = true;
            break;
          }

          const responseText = await response.text();
          console.log(`Response: ${responseText.substring(0, 200)}`);
        } catch (err) {
          const error = err as Error;
          lastError = error.message;
          console.error(`Error with ${endpoint.method} ${endpoint.path}:`, error.message);
        }
      }
    }

    // Limpar cache de QR code e atualizar status no banco
    console.log('Clearing QR code cache and updating status...');
    
    const { error: updateError } = await supabase
      .from('whatsapp_instances')
      .update({
        qrcode: null,
        qrcode_updated_at: null,
        status: 'reconnecting',
        phone_number: null,
        connected_at: null,
      })
      .eq('instance_key', instanceKey);

    if (updateError) {
      console.error('Error updating instance:', updateError);
    } else {
      console.log('Instance status updated to reconnecting');
    }

    // Se não encontrou instância, criar uma com status reconnecting
    if (!instanceData) {
      const { error: insertError } = await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: instanceKey,
          status: 'reconnecting',
          qrcode: null,
          qrcode_updated_at: null,
        });

      if (insertError) {
        console.error('Error creating instance:', insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        apiSuccess,
        message: apiSuccess 
          ? 'Instância reiniciada com sucesso. Aguarde o novo QR Code.'
          : 'Cache limpo. Configure o webhook para receber o QR Code automaticamente.',
        lastError: apiSuccess ? null : lastError,
        webhookUrl: `${supabaseUrl}/functions/v1/mega-api-webhook`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error in mega-api-restart-instance:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

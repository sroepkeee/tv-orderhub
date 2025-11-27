import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Testing webhook configuration...');

    // Verificar autorização do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar se usuário está autorizado
    const { data: authData } = await supabase
      .from('whatsapp_authorized_users')
      .select('is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!authData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not authorized for WhatsApp' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    // Buscar último webhook recebido
    const { data: lastWebhook } = await supabase
      .from('whatsapp_message_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Verificar status da conexão através do mega-api-status
    const megaApiUrl = Deno.env.get('MEGA_API_URL');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN');
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE');

    if (!megaApiUrl || !megaApiToken || !megaApiInstance) {
      throw new Error('Mega API configuration missing');
    }

    const statusResponse = await fetch(
      `${megaApiUrl}/rest/instance/connectionState/${megaApiInstance}`,
      {
        headers: {
          'Authorization': `Bearer ${megaApiToken}`,
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error('Failed to check connection status');
    }

    const statusData = await statusResponse.json();
    const isConnected = statusData?.state === 'open';

    console.log('Webhook test completed:', {
      connected: isConnected,
      lastWebhook: lastWebhook?.created_at,
    });

    return new Response(
      JSON.stringify({
        success: true,
        webhookConfigured: !!lastWebhook,
        lastWebhookReceived: lastWebhook?.created_at || null,
        connectionActive: isConnected,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error testing webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

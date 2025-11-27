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

    // Verificar se usuário está autorizado (whitelist OU admin)
    const { data: authData } = await supabase
      .from('whatsapp_authorized_users')
      .select('is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    // Verificar se é admin
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!authData && !adminRole) {
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
      .maybeSingle();

    // Buscar dados da instância no banco
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE');
    
    if (!megaApiInstance) {
      throw new Error('Mega API instance configuration missing');
    }

    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();

    console.log('Webhook test completed:', {
      connected: instanceData?.status === 'connected',
      lastWebhook: lastWebhook?.created_at,
      instanceData: instanceData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        webhookConfigured: !!lastWebhook || !!instanceData?.qrcode_updated_at,
        lastWebhookReceived: lastWebhook?.created_at || instanceData?.qrcode_updated_at || null,
        connectionActive: instanceData?.status === 'connected',
        phoneNumber: instanceData?.phone_number,
        connectedAt: instanceData?.connected_at,
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

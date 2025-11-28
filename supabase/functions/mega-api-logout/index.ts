import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autorização (whatsapp_authorized_users ou admin)
    const { data: whatsappAuth } = await supabase
      .from('whatsapp_authorized_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!whatsappAuth && !adminRole) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to manage WhatsApp connections' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações da API
    const apiUrl = Deno.env.get('MEGA_API_URL');
    const apiToken = Deno.env.get('MEGA_API_TOKEN');
    const instanceKey = Deno.env.get('MEGA_API_INSTANCE');

    if (!apiUrl || !apiToken || !instanceKey) {
      console.error('Missing Mega API configuration');
      return new Response(
        JSON.stringify({ error: 'WhatsApp API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Disconnecting instance:', instanceKey);

    // Tentar desconectar via Mega API
    try {
      const logoutUrl = `${apiUrl}/rest/instance/logout/${instanceKey}`;
      console.log('Calling Mega API logout:', logoutUrl);

      const response = await fetch(logoutUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
      });

      const responseText = await response.text();
      console.log('Mega API response:', response.status, responseText);

      // Atualizar status no banco de dados independentemente do resultado da API
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { error: updateError } = await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          phone_number: null,
          connected_at: null,
          qrcode: null,
          qrcode_updated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('instance_key', instanceKey);

      if (updateError) {
        console.error('Error updating database:', updateError);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'WhatsApp disconnected successfully',
          apiResponse: response.status === 200 ? 'success' : 'partial'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (apiError) {
      console.error('Error calling Mega API:', apiError);

      // Ainda assim atualizar o banco de dados
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          phone_number: null,
          connected_at: null,
          qrcode: null,
          qrcode_updated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('instance_key', instanceKey);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Database updated to disconnected state',
          warning: 'API call failed but database updated'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in mega-api-logout:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

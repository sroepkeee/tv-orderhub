import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function para sincronizar credenciais Mega API do Secrets para o banco
 * Isso garante que o token correto seja usado sem expor no frontend
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter credenciais do environment (Secrets)
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE') ?? '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';
    const megaApiUrl = Deno.env.get('MEGA_API_URL') ?? '';

    console.log('🔄 Syncing credentials from Secrets to database...');
    console.log('📌 Instance from env:', megaApiInstance);
    console.log('🔑 Token configured:', megaApiToken ? 'Yes' : 'No');
    console.log('🌐 URL:', megaApiUrl);

    // Validar que temos credenciais
    if (!megaApiInstance) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MEGA_API_INSTANCE não configurado nos Secrets',
          help: 'Configure MEGA_API_INSTANCE nas configurações de Secrets do projeto'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!megaApiToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MEGA_API_TOKEN não configurado nos Secrets',
          help: 'Configure MEGA_API_TOKEN nas configurações de Secrets do projeto'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar se token parece placeholder
    const placeholders = ['SEU_TOKEN', 'API_KEY', 'YOUR_TOKEN', 'TOKEN_AQUI', 'PLACEHOLDER', 'XXX'];
    const isPlaceholder = placeholders.some(p => megaApiToken.toUpperCase().includes(p));
    
    if (isPlaceholder) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MEGA_API_TOKEN parece ser um placeholder',
          help: 'Configure o token real da Mega API nos Secrets'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Desativar outras instâncias ativas
    await supabase
      .from('whatsapp_instances')
      .update({ is_active: false })
      .neq('instance_key', megaApiInstance);

    // Verificar se a instância existe
    const { data: existingInstance } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_key, api_token, status')
      .eq('instance_key', megaApiInstance)
      .maybeSingle();

    let result;

    if (existingInstance) {
      // Atualizar instância existente
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update({
          api_token: megaApiToken,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('instance_key', megaApiInstance)
        .select()
        .single();

      if (error) throw error;
      result = data;
      
      console.log('✅ Updated existing instance:', megaApiInstance);
    } else {
      // Criar nova instância
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          instance_key: megaApiInstance,
          api_token: megaApiToken,
          name: `Instance ${megaApiInstance}`,
          is_active: true,
          status: 'close', // Status inicial, será atualizado pelo webhook
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
      
      console.log('✅ Created new instance:', megaApiInstance);
    }

    // Log para auditoria
    await supabase.from('whatsapp_event_log').insert({
      event_type: 'credentials_synced',
      payload: {
        instance_key: megaApiInstance,
        synced_from: 'secrets',
        token_length: megaApiToken.length,
        previous_status: existingInstance?.status,
      },
      processed: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: existingInstance ? 'Credenciais atualizadas' : 'Instância criada',
        instance: {
          instance_key: result.instance_key,
          status: result.status,
          is_active: result.is_active,
          token_configured: true,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error syncing credentials:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

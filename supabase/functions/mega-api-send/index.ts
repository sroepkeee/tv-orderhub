import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  carrierId: string;
  orderId?: string; // Optional - for general conversations
  message: string;
  conversationType: string;
  contactType?: string; // 'carrier' | 'customer' | 'technician' | 'supplier'
}

// === NORMALIZAÇÃO INTELIGENTE DE TELEFONE ===

// Detectar formato do telefone recebido
function detectPhoneFormat(phone: string): 'with_nine' | 'without_nine' {
  const digits = phone.replace(/\D/g, '');
  
  // Se tem 13 dígitos (55 + DDD + 9 + 8) e o 5º dígito é 9
  if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
    return 'with_nine';
  }
  
  return 'without_nine';
}

// Normalizar telefone PRESERVANDO o formato original
function normalizePhonePreserving(phone: string): { normalized: string; format: 'with_nine' | 'without_nine' } {
  if (!phone) return { normalized: '', format: 'without_nine' };
  
  let digits = phone.replace(/\D/g, '');
  
  // Limpar números corrompidos (mais de 13 dígitos)
  if (digits.length > 13) {
    digits = digits.slice(0, 13);
  }
  
  // Adicionar 55 se não tem
  if (!digits.startsWith('55') && digits.length <= 11) {
    digits = '55' + digits;
  }
  
  const format = detectPhoneFormat(digits);
  
  return { normalized: digits, format };
}

// Gerar variantes para envio baseado no formato preferido
function getPhoneVariantsForSending(
  phone: string, 
  preferredFormat: 'with_nine' | 'without_nine' | null
): string[] {
  const { normalized } = normalizePhonePreserving(phone);
  const variants: string[] = [];
  
  // Garantir que tem código do país
  let base = normalized.startsWith('55') ? normalized : '55' + normalized;
  
  // Calcular versão SEM 9
  let withoutNine = base;
  if (base.length === 13 && base.startsWith('55') && base.charAt(4) === '9') {
    const ddd = base.substring(2, 4);
    const numero = base.substring(5);
    withoutNine = '55' + ddd + numero;
  }
  
  // Calcular versão COM 9
  let withNine = base;
  if (base.length === 12 && base.startsWith('55')) {
    const ddd = base.substring(2, 4);
    const numero = base.substring(4);
    withNine = '55' + ddd + '9' + numero;
  } else if (base.length === 13 && base.startsWith('55') && base.charAt(4) === '9') {
    withNine = base; // Já está no formato com 9
  }
  
  // Ordenar baseado no formato preferido
  if (preferredFormat === 'without_nine') {
    variants.push(withoutNine);
    if (withNine !== withoutNine) variants.push(withNine);
  } else if (preferredFormat === 'with_nine') {
    variants.push(withNine);
    if (withoutNine !== withNine) variants.push(withoutNine);
  } else {
    // Sem preferência: tentar SEM 9 primeiro (padrão)
    variants.push(withoutNine);
    if (withNine !== withoutNine) variants.push(withNine);
  }
  
  console.log('📱 Phone variants for sending:', {
    original: phone,
    preferredFormat,
    variants
  });
  
  return variants;
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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar se usuário está autorizado (whitelist OU admin)
    const { data: authData } = await supabase
      .from('whatsapp_authorized_users')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!authData && !adminRole) {
      throw new Error('User not authorized to send WhatsApp messages');
    }

    const { carrierId, orderId, message, conversationType, contactType }: SendMessageRequest = await req.json();

    // Buscar dados da transportadora incluindo formato preferido do telefone
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('id, name, whatsapp, phone_format')
      .eq('id', carrierId)
      .single();

    if (carrierError || !carrier || !carrier.whatsapp) {
      throw new Error('Carrier not found or WhatsApp not configured');
    }
    
    // Gerar variantes do telefone baseado no formato preferido
    const phoneVariants = getPhoneVariantsForSending(
      carrier.whatsapp, 
      carrier.phone_format as 'with_nine' | 'without_nine' | null
    );
    let phoneNumber = phoneVariants[0]; // Usar primeira variante como padrão

    // Buscar informações do pedido para contexto (opcional)
    let order = null;
    if (orderId) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name')
        .eq('id', orderId)
        .maybeSingle();
      order = orderData;
    }

    // Montar mensagem com contexto
    const fullMessage = order 
      ? `*Pedido ${order.order_number}* - ${order.customer_name}\n\n${message}`
      : message;

    // Buscar instância conectada do banco de dados
    const { data: activeInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .maybeSingle();

    if (!activeInstance) {
      throw new Error('No connected WhatsApp instance found. Please connect a WhatsApp account first.');
    }

    // Enviar mensagem via Mega API com múltiplas tentativas
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    
    // Garantir que a URL tenha protocolo https
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    
    // Remover barra final se houver
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';
    const megaApiInstance = activeInstance.instance_key;
    
    console.log('✅ Using WhatsApp instance from DB:', megaApiInstance);

    console.log('Sending WhatsApp message:', {
      instance: megaApiInstance,
      phoneNumber,
      messagePreview: fullMessage.substring(0, 50)
    });


    

    // Mega API START usa /rest/sendMessage/{instance}/text
    const endpoint = `/rest/sendMessage/${megaApiInstance}/text`;
    const fullUrl = `${megaApiUrl}${endpoint}`;

    console.log('Sending to:', fullUrl);

    // Body formato Mega API: { messageData: { to, text, linkPreview } }
    const body = {
      messageData: {
        to: phoneNumber,
        text: fullMessage,
        linkPreview: false,
      }
    };

    console.log('Request body:', JSON.stringify(body));

    // Multi-header fallback para compatibilidade
    const authFormats: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
      { 'Apikey': megaApiToken },
    ];

    let megaData: any = null;
    let lastError = '';
    let successfulPhoneNumber = phoneNumber;

    // Tentar enviar com cada variante de telefone
    for (const phoneVariant of phoneVariants) {
      console.log(`📱 Trying phone variant: ${phoneVariant}`);
      
      // Atualizar body com a variante atual
      body.messageData.to = phoneVariant;
      
      for (const authHeader of authFormats) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...authHeader,
        };

        const megaResponse = await fetch(fullUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        const responseText = await megaResponse.text();
        console.log(`Response (${Object.keys(authHeader)[0]}, ${phoneVariant}):`, megaResponse.status, responseText.substring(0, 300));

        if (megaResponse.ok) {
          try {
            megaData = JSON.parse(responseText);
          } catch {
            megaData = { raw: responseText };
          }
          successfulPhoneNumber = phoneVariant;
          
          // Atualizar phone_format do carrier com o formato que funcionou
          const newFormat = detectPhoneFormat(phoneVariant);
          if (carrier.phone_format !== newFormat) {
            console.log(`📱 Updating carrier phone_format to: ${newFormat}`);
            await supabase
              .from('carriers')
              .update({ phone_format: newFormat })
              .eq('id', carrierId);
          }
          
          break; // Sucesso
        } else if (megaResponse.status === 401 || megaResponse.status === 403) {
          lastError = `${megaResponse.status}: ${responseText}`;
          continue; // Tentar próximo header
        } else {
          lastError = `${megaResponse.status}: ${responseText}`;
          // Não throw aqui, tentar próxima variante
        }
      }
      
      if (megaData) break; // Sucesso, sair do loop de variantes
    }

    if (!megaData) {
      throw new Error(`All phone variants failed. Last error: ${lastError}`);
    }
    
    // Usar o número que funcionou
    phoneNumber = successfulPhoneNumber;

    console.log('Mega API response:', megaData);

    // Salvar conversa no banco
    const { data: conversation, error: conversationError } = await supabase
      .from('carrier_conversations')
      .insert({
        carrier_id: carrierId,
        order_id: orderId || null,
        conversation_type: conversationType,
        message_direction: 'outbound',
        message_content: fullMessage,
        contact_type: contactType || 'carrier',
        message_metadata: {
          sent_via: 'mega_api',
          phone_number: phoneNumber,
          mega_message_id: megaData.id || null,
        },
        sent_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error saving conversation:', conversationError);
      throw conversationError;
    }

    // Salvar log de mensagem
    await supabase.from('whatsapp_message_log').insert({
      conversation_id: conversation.id,
      mega_message_id: megaData.id || null,
      status: 'sent',
    });

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: conversation.id,
        megaMessageId: megaData.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mega-api-send:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

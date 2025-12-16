import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      carrierId, 
      phoneNumber, 
      mediaType, // 'image' | 'document' | 'audio'
      base64Data,
      fileName,
      caption,
      mimeType,
      orderId,
      isPtt // for audio: push-to-talk (appears as voice message)
    } = await req.json();

    if (!phoneNumber || !mediaType || !base64Data) {
      throw new Error('phoneNumber, mediaType e base64Data são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get connected WhatsApp instance
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .single();

    if (!instance?.instance_key) {
      throw new Error('Nenhuma instância WhatsApp conectada');
    }

    // Get Mega API credentials
    let megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN');

    if (!megaApiUrl || !megaApiToken) {
      throw new Error('Credenciais Mega API não configuradas');
    }

    // Normalize URL
    megaApiUrl = megaApiUrl.trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = 'https://' + megaApiUrl;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');

    // Format phone number
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber;
    }

    console.log(`📤 Sending ${mediaType} to ${formattedNumber} via instance ${instance.instance_key}`);

    // Build endpoint and body based on media type
    let endpoint = '';
    let body: any = {};

    switch (mediaType) {
      case 'image':
        endpoint = `/message/sendImage/${instance.instance_key}`;
        body = {
          number: formattedNumber,
          imageMessage: {
            image: base64Data.startsWith('data:') ? base64Data : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`,
            caption: caption || ''
          }
        };
        break;

      case 'document':
        endpoint = `/message/sendDocument/${instance.instance_key}`;
        body = {
          number: formattedNumber,
          documentMessage: {
            document: base64Data.startsWith('data:') ? base64Data : `data:${mimeType || 'application/pdf'};base64,${base64Data}`,
            fileName: fileName || 'documento.pdf',
            caption: caption || ''
          }
        };
        break;

      case 'audio':
        endpoint = `/message/sendAudio/${instance.instance_key}`;
        body = {
          number: formattedNumber,
          audioMessage: {
            audio: base64Data.startsWith('data:') ? base64Data : `data:${mimeType || 'audio/ogg'};base64,${base64Data}`,
            ptt: isPtt !== false // Default to PTT (voice message)
          }
        };
        break;

      default:
        throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
    }

    // Try multiple endpoint variations for compatibility
    const endpointVariations = [
      endpoint,
      `/rest${endpoint}`,
      endpoint.replace('/message/', '/rest/message/'),
    ];

    let megaResponse = null;
    let lastError = null;

    for (const ep of endpointVariations) {
      try {
        console.log(`🔄 Trying endpoint: ${megaApiUrl}${ep}`);
        
        const response = await fetch(`${megaApiUrl}${ep}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': megaApiToken,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          megaResponse = await response.json();
          console.log('✅ Media sent successfully:', megaResponse);
          break;
        } else {
          lastError = await response.text();
          console.warn(`⚠️ Endpoint ${ep} failed:`, lastError);
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`⚠️ Endpoint ${ep} error:`, lastError);
      }
    }

    if (!megaResponse) {
      throw new Error(`Falha ao enviar mídia: ${lastError}`);
    }

    // Save conversation record
    const mediaTypeLabels: Record<string, string> = {
      image: '[Imagem]',
      document: '[Documento]',
      audio: '[Áudio]',
    };

    const messageContent = caption 
      ? `${mediaTypeLabels[mediaType]} ${caption}`
      : mediaTypeLabels[mediaType];

    const conversationData: any = {
      carrier_id: carrierId,
      message_content: messageContent,
      message_direction: 'outbound',
      conversation_type: 'media',
      contact_type: 'carrier',
      sent_at: new Date().toISOString(),
      has_media: true,
      media_type: mediaType,
      n8n_message_id: megaResponse?.key?.id || null,
    };

    if (orderId) {
      conversationData.order_id = orderId;
    }

    const { data: conversation, error: convError } = await supabase
      .from('carrier_conversations')
      .insert(conversationData)
      .select()
      .single();

    if (convError) {
      console.error('❌ Error saving conversation:', convError);
    } else {
      // Save media record
      const { error: mediaError } = await supabase
        .from('whatsapp_media')
        .insert({
          conversation_id: conversation.id,
          media_type: mediaType,
          mime_type: mimeType,
          file_name: fileName,
          base64_data: base64Data.substring(0, 1000), // Store truncated for reference
          caption: caption,
        });

      if (mediaError) {
        console.error('❌ Error saving media record:', mediaError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: megaResponse?.key?.id,
        conversationId: conversation?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in mega-api-send-media:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

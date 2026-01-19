import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos para mídia
interface MediaData {
  type: 'image' | 'audio' | 'document' | 'video' | 'sticker';
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  caption: string | null;
  base64_data: string | null;
  thumbnail_base64: string | null;
  duration_seconds: number | null;
  media_key: string | null;
  direct_path: string | null;
  file_sha256: string | null;
}

// Função para extrair mídia da mensagem
function extractMediaFromMessage(message: any): MediaData | null {
  if (!message) return null;

  // Imagem
  if (message.imageMessage) {
    return {
      type: 'image',
      mime_type: message.imageMessage.mimetype || 'image/jpeg',
      file_name: message.imageMessage.fileName || 'image.jpg',
      file_size: message.imageMessage.fileLength ? parseInt(message.imageMessage.fileLength) : null,
      caption: message.imageMessage.caption || null,
      base64_data: message.imageMessage.base64 || null,
      thumbnail_base64: message.imageMessage.jpegThumbnail || null,
      duration_seconds: null,
      media_key: message.imageMessage.mediaKey || null,
      direct_path: message.imageMessage.directPath || null,
      file_sha256: message.imageMessage.fileSha256 || null,
    };
  }

  // Áudio
  if (message.audioMessage) {
    return {
      type: 'audio',
      mime_type: message.audioMessage.mimetype || 'audio/ogg',
      file_name: message.audioMessage.ptt ? 'voice_message.ogg' : 'audio.ogg',
      file_size: message.audioMessage.fileLength ? parseInt(message.audioMessage.fileLength) : null,
      caption: null,
      base64_data: message.audioMessage.base64 || null,
      thumbnail_base64: null,
      duration_seconds: message.audioMessage.seconds || null,
      media_key: message.audioMessage.mediaKey || null,
      direct_path: message.audioMessage.directPath || null,
      file_sha256: message.audioMessage.fileSha256 || null,
    };
  }

  // Documento/PDF
  if (message.documentMessage) {
    return {
      type: 'document',
      mime_type: message.documentMessage.mimetype || 'application/pdf',
      file_name: message.documentMessage.fileName || 'document.pdf',
      file_size: message.documentMessage.fileLength ? parseInt(message.documentMessage.fileLength) : null,
      caption: message.documentMessage.caption || null,
      base64_data: message.documentMessage.base64 || null,
      thumbnail_base64: message.documentMessage.jpegThumbnail || null,
      duration_seconds: null,
      media_key: message.documentMessage.mediaKey || null,
      direct_path: message.documentMessage.directPath || null,
      file_sha256: message.documentMessage.fileSha256 || null,
    };
  }

  // Vídeo
  if (message.videoMessage) {
    return {
      type: 'video',
      mime_type: message.videoMessage.mimetype || 'video/mp4',
      file_name: message.videoMessage.fileName || 'video.mp4',
      file_size: message.videoMessage.fileLength ? parseInt(message.videoMessage.fileLength) : null,
      caption: message.videoMessage.caption || null,
      base64_data: message.videoMessage.base64 || null,
      thumbnail_base64: message.videoMessage.jpegThumbnail || null,
      duration_seconds: message.videoMessage.seconds || null,
      media_key: message.videoMessage.mediaKey || null,
      direct_path: message.videoMessage.directPath || null,
      file_sha256: message.videoMessage.fileSha256 || null,
    };
  }

  // Sticker
  if (message.stickerMessage) {
    return {
      type: 'sticker',
      mime_type: message.stickerMessage.mimetype || 'image/webp',
      file_name: 'sticker.webp',
      file_size: message.stickerMessage.fileLength ? parseInt(message.stickerMessage.fileLength) : null,
      caption: null,
      base64_data: message.stickerMessage.base64 || null,
      thumbnail_base64: null,
      duration_seconds: null,
      media_key: message.stickerMessage.mediaKey || null,
      direct_path: message.stickerMessage.directPath || null,
      file_sha256: message.stickerMessage.fileSha256 || null,
    };
  }

  return null;
}

// Função para salvar mídia no banco de dados
async function saveMediaToDatabase(
  supabase: any,
  conversationId: string,
  mediaData: MediaData
): Promise<{ id: string } | null> {
  try {
    console.log('💾 Saving media to database:', {
      type: mediaData.type,
      mime_type: mediaData.mime_type,
      file_name: mediaData.file_name,
      has_base64: !!mediaData.base64_data,
      has_thumbnail: !!mediaData.thumbnail_base64,
    });

    const { data, error } = await supabase
      .from('whatsapp_media')
      .insert({
        conversation_id: conversationId,
        media_type: mediaData.type,
        mime_type: mediaData.mime_type,
        file_name: mediaData.file_name,
        file_size_bytes: mediaData.file_size,
        base64_data: mediaData.base64_data,
        thumbnail_base64: mediaData.thumbnail_base64,
        duration_seconds: mediaData.duration_seconds,
        caption: mediaData.caption,
        media_key: mediaData.media_key,
        direct_path: mediaData.direct_path,
        file_sha256: mediaData.file_sha256,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error saving media:', error);
      return null;
    }

    console.log('✅ Media saved successfully:', data.id);
    return data;
  } catch (err) {
    console.error('❌ Exception saving media:', err);
    return null;
  }
}

// Função para extrair dados de cotação da mensagem
function extractQuoteData(messageText: string): {
  freight_value: number | null;
  delivery_time_days: number | null;
} {
  let freight_value: number | null = null;
  let delivery_time_days: number | null = null;

  // Regex para valor do frete (aceita vários formatos)
  const valuePatterns = [
    /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // R$ 1.234,56
    /valor[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // valor: R$ 1.234,56
    /frete[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // frete: R$ 1.234,56
    /cotação[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i, // cotação: R$ 1.234,56
  ];

  for (const pattern of valuePatterns) {
    const match = messageText.match(pattern);
    if (match) {
      // Converter formato brasileiro para número
      const cleanValue = match[1].replace(/\./g, '').replace(',', '.');
      freight_value = parseFloat(cleanValue);
      break;
    }
  }

  // Regex para prazo de entrega (aceita vários formatos)
  const timePatterns = [
    /(\d+)\s*dias?\s*(?:úteis)?/i,  // 5 dias, 10 dias úteis
    /prazo[:\s]*(\d+)\s*dias?/i,    // prazo: 5 dias
    /entrega[:\s]*(\d+)\s*dias?/i,  // entrega: 10 dias
  ];

  for (const pattern of timePatterns) {
    const match = messageText.match(pattern);
    if (match) {
      delivery_time_days = parseInt(match[1]);
      break;
    }
  }

  return { freight_value, delivery_time_days };
}

// Interface para flags de compliance
interface ComplianceFlag {
  rule_id: string;
  policy: string;
  keyword_matched: string;
  risk_level: string;
  action: string;
  description: string;
}

interface ComplianceResult {
  has_violations: boolean;
  highest_risk: string;
  flags: ComplianceFlag[];
  requires_human_review: boolean;
}

// Função para verificar compliance de mensagens contra regras ai_rules
async function checkCompliance(
  supabase: any,
  messageText: string
): Promise<ComplianceResult> {
  const riskOrder: Record<string, number> = {
    'low': 1,
    'moderate': 2,
    'high': 3,
    'critical': 4,
  };

  const result: ComplianceResult = {
    has_violations: false,
    highest_risk: 'low',
    flags: [],
    requires_human_review: false,
  };

  try {
    // Buscar regras ativas do banco
    const { data: rules, error } = await supabase
      .from('ai_rules')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error fetching compliance rules:', error);
      return result;
    }

    if (!rules || rules.length === 0) {
      console.log('ℹ️ No active compliance rules found');
      return result;
    }

    const messageLower = messageText.toLowerCase();
    console.log(`🔍 Checking message against ${rules.length} compliance rules`);

    for (const rule of rules) {
      // Keywords são separados por vírgula na coluna 'rule'
      const keywords = (rule.rule || '').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      
      for (const keyword of keywords) {
        if (keyword && messageLower.includes(keyword)) {
          const flag: ComplianceFlag = {
            rule_id: rule.id,
            policy: rule.policy || 'Geral',
            keyword_matched: keyword,
            risk_level: rule.rule_risk || 'low',
            action: rule.action || 'log',
            description: rule.rule_description || '',
          };
          
          result.flags.push(flag);
          result.has_violations = true;

          // Atualizar maior risco
          if (riskOrder[flag.risk_level] > riskOrder[result.highest_risk]) {
            result.highest_risk = flag.risk_level;
          }

          // Verificar se precisa review humano
          if (flag.action === 'block' || flag.action === 'warn' || flag.risk_level === 'high' || flag.risk_level === 'critical') {
            result.requires_human_review = true;
          }

          console.log(`⚠️ Compliance flag: ${flag.policy} - ${keyword} (${flag.risk_level})`);
          break; // Não continuar verificando keywords desta regra
        }
      }
    }

    if (result.has_violations) {
      console.log(`🚨 Compliance check: ${result.flags.length} violations found, highest risk: ${result.highest_risk}`);
    } else {
      console.log('✅ Compliance check: No violations found');
    }

  } catch (err) {
    console.error('❌ Exception in compliance check:', err);
  }

  return result;
}

// Função para obter texto descritivo da mídia
function getMediaDisplayText(mediaData: MediaData): string {
  const typeLabels: Record<string, string> = {
    image: '📷 Imagem',
    audio: '🎵 Áudio',
    document: '📄 Documento',
    video: '🎬 Vídeo',
    sticker: '🎭 Sticker',
  };

  const typeLabel = typeLabels[mediaData.type] || '📎 Mídia';
  
  if (mediaData.caption) {
    return `${typeLabel}: ${mediaData.caption}`;
  }
  
  if (mediaData.file_name && mediaData.type === 'document') {
    return `${typeLabel}: ${mediaData.file_name}`;
  }
  
  if (mediaData.duration_seconds && (mediaData.type === 'audio' || mediaData.type === 'video')) {
    return `${typeLabel} (${mediaData.duration_seconds}s)`;
  }
  
  return typeLabel;
}

// Função para enviar mensagem de auto-reply via Mega API
async function sendAutoReplyMessage(
  phoneNumber: string, 
  message: string, 
  carrierId: string | null, 
  supabase: any
): Promise<boolean> {
  try {
    const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';
    
    // Buscar instância conectada
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!instance?.instance_key) {
      console.error('❌ No connected WhatsApp instance found for auto-reply');
      return false;
    }

    // Normalizar URL
    let normalizedUrl = megaApiUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    // NOVO PADRÃO: 55 + DDD + 8 dígitos (SEM o 9)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }
    // Remover o 9 se presente (formato antigo)
    if (formattedPhone.length === 13 && formattedPhone.startsWith('55') && formattedPhone.charAt(4) === '9') {
      const ddd = formattedPhone.substring(2, 4);
      const numero = formattedPhone.substring(5);
      formattedPhone = '55' + ddd + numero;
    }

    // Mega API START usa /rest/sendMessage/{instance}/text
    const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
    const sendUrl = `${normalizedUrl}${endpoint}`;

    // Body formato Mega API: { messageData: { to, text, linkPreview } }
    const body = {
      messageData: {
        to: formattedPhone,
        text: message,
        linkPreview: false,
      }
    };

    console.log(`📤 Sending auto-reply to: ${sendUrl}`);

    // Multi-header fallback para compatibilidade
    const authFormats: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
      { 'Apikey': megaApiToken },
    ];

    for (const authHeader of authFormats) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...authHeader,
        };

        const response = await fetch(sendUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (response.ok) {
          console.log('✅ Auto-reply message sent successfully');
          
          if (carrierId) {
            await supabase
              .from('carrier_conversations')
              .insert({
                carrier_id: carrierId,
                conversation_type: 'general',
                message_direction: 'outbound',
                message_content: message,
                contact_type: 'customer',
                message_metadata: {
                  sent_via: 'ai_auto_reply',
                  sent_at: new Date().toISOString(),
                },
                sent_at: new Date().toISOString(),
              });
          }
          
          return true;
        } else if (response.status === 401 || response.status === 403) {
          const errorText = await response.text();
          console.log(`❌ Auth failed (${Object.keys(authHeader)[0]}): ${response.status} - trying next...`);
          continue; // Tentar próximo header
        } else {
          const errorText = await response.text();
          console.log(`❌ Failed ${response.status}: ${errorText.substring(0, 100)}`);
          return false;
        }
      } catch (err) {
        console.error('❌ Fetch error:', err);
        continue;
      }
    }
    
    console.error('❌ All auth methods failed');
    return false;
  } catch (error) {
    console.error('❌ Error sending auto-reply:', error);
    return false;
  }
}

// Função para verificar se o número é de um gestor cadastrado
async function checkIfManager(supabase: any, phoneNumber: string): Promise<boolean> {
  try {
    // Criar variações do número para busca flexível
    const phoneClean = phoneNumber.replace(/\D/g, '');
    const lastDigits = phoneClean.slice(-8);
    const last9Digits = phoneClean.slice(-9);
    
    console.log('🔍 [DIAGNOSTIC] checkIfManager called with:', phoneNumber);
    console.log('🔍 [DIAGNOSTIC] Phone variations:', { phoneClean, lastDigits, last9Digits });
    
    // Buscar na tabela profiles onde is_manager = true
    const { data: managers, error } = await supabase
      .from('profiles')
      .select('id, full_name, is_manager, whatsapp')
      .eq('is_manager', true);
    
    if (error) {
      console.error('❌ [DIAGNOSTIC] Error fetching managers:', error);
      return false;
    }
    
    console.log('🔍 [DIAGNOSTIC] Found managers:', managers?.length || 0);
    managers?.forEach((m: any) => {
      console.log(`   - ${m.full_name}: whatsapp=${m.whatsapp}, is_manager=${m.is_manager}`);
    });
    
    // Verificar se algum gestor corresponde ao número
    const matchedManager = managers?.find((m: any) => {
      if (!m.whatsapp) return false;
      const managerPhone = m.whatsapp.replace(/\D/g, '');
      
      // Tentar múltiplas formas de match
      const matches = 
        managerPhone.includes(lastDigits) ||
        managerPhone.includes(last9Digits) ||
        phoneClean.includes(managerPhone.slice(-8)) ||
        managerPhone === phoneClean;
      
      if (matches) {
        console.log(`🔍 [DIAGNOSTIC] Match found! Manager phone: ${managerPhone}`);
      }
      return matches;
    });
    
    const isManager = !!matchedManager;
    console.log(`👔 [DIAGNOSTIC] Manager check result for ${phoneNumber}: ${isManager ? 'YES' : 'NO'}${matchedManager ? ` (${matchedManager.full_name})` : ''}`);
    return isManager;
  } catch (err) {
    console.error('❌ [DIAGNOSTIC] Exception in checkIfManager:', err);
    return false;
  }
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

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // ✅ SECURITY: Validar instância
    const instanceKey = payload.instance_key || payload.instance;
    const expectedInstance = Deno.env.get('MEGA_API_INSTANCE');
    console.log('🔑 Instance key received:', instanceKey);
    console.log('🔑 Expected instance (from env):', expectedInstance);
    
    if (!instanceKey) {
      console.error('❌ SECURITY: No instance key provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Missing instance key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar QR Code Update PRIMEIRO - permite registrar novas instâncias
    const qrcode = 
      payload.qrcode ||
      payload.data?.qrcode ||
      payload.qrcode?.base64 ||
      payload.data?.qrcode?.base64 ||
      payload.data?.code ||
      payload.code;

    const isQrCodeEvent = 
      payload.messageType === 'qrcode_update' ||
      payload.event === 'qrcode.updated' ||
      payload.event === 'qrcode' ||
      payload.event === 'qr_code' ||
      (payload.event === 'connection.update' && qrcode) ||
      !!qrcode;

    const isConnectionEvent = 
      payload.event === 'connection.update' || 
      payload.messageType === 'connection_update';

    // QR/Connection events podem registrar/atualizar instâncias sem validação prévia
    if (isQrCodeEvent && qrcode) {
      console.log('📱 QR Code update received - auto-registering instance');
      
      const { error: upsertError } = await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: instanceKey,
          qrcode: qrcode,
          qrcode_updated_at: new Date().toISOString(),
          status: 'waiting_scan',
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'instance_key' });

      if (upsertError) {
        console.error('Error saving QR code:', upsertError);
        throw upsertError;
      }

      console.log('✅ QR code cached and instance registered');

      return new Response(
        JSON.stringify({ 
          success: true, 
          event: 'qrcode_update',
          cached: true,
          instanceRegistered: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    // Para eventos de conexão, também permitir atualização
    if (isConnectionEvent && !qrcode) {
      console.log('📱 Connection update - processing without strict validation');
      // Continua para processar o evento de conexão abaixo
    } else {
      // Para mensagens, validar instância de forma mais resiliente
      // Primeiro verifica se corresponde ao env (whitelist primária)
      const isWhitelisted = expectedInstance && instanceKey === expectedInstance;
      
      if (isWhitelisted) {
        console.log('✅ Instance validated via env whitelist');
      } else {
        // Fallback: verificar no banco de dados
        const { data: validInstance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('instance_key, is_active')
          .eq('instance_key', instanceKey)
          .maybeSingle();
        
        if (instanceError) {
          console.error('❌ Error checking instance (non-blocking):', instanceError.message);
          // Continuar mesmo com erro de schema - pode ser coluna faltando
        }
        
        if (!validInstance) {
          console.error('❌ SECURITY: Unknown instance:', instanceKey);
          console.error('❌ Expected:', expectedInstance);
          // Logar tentativa de acesso não autorizado (fire and forget)
          Promise.resolve(supabase.from('ai_notification_log').insert({
            channel: 'webhook',
            recipient: 'system',
            message_content: `Webhook com instance_key não registrada: ${instanceKey}`,
            status: 'blocked',
            metadata: { 
              security_event: 'unknown_instance',
              instance_key: instanceKey,
              expected_instance: expectedInstance,
              ip: req.headers.get('x-forwarded-for') || 'unknown'
            }
          })).catch(() => {}); // Ignorar erro de log
          
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized - Invalid instance' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Verificar se a instância está ativa
        if (validInstance.is_active === false) {
          console.warn('⚠️ Instance is inactive:', instanceKey);
          return new Response(
            JSON.stringify({ success: false, error: 'Instance is inactive' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('✅ Instance validated via database');
      }
    }

    // Processar diferentes tipos de evento de mensagem
    const messageType = payload.messageType || payload.event;
    console.log('📩 Processing event type:', messageType);
    
    // Detectar mensagens de mídia
    const isMediaMessage = 
      messageType === 'imageMessage' ||
      messageType === 'audioMessage' ||
      messageType === 'documentMessage' ||
      messageType === 'videoMessage' ||
      messageType === 'stickerMessage' ||
      payload.message?.imageMessage ||
      payload.message?.audioMessage ||
      payload.message?.documentMessage ||
      payload.message?.videoMessage ||
      payload.message?.stickerMessage ||
      payload.data?.message?.imageMessage ||
      payload.data?.message?.audioMessage ||
      payload.data?.message?.documentMessage ||
      payload.data?.message?.videoMessage ||
      payload.data?.message?.stickerMessage;
    
    if (payload.event === 'messages.upsert' || messageType === 'conversation' || messageType === 'extendedTextMessage' || isMediaMessage) {
      console.log('📩 Processing message event (text or media)');
      
      // Aceitar payload direto ou aninhado em .data
      const messageData = payload.data || payload;
      const key = payload.key || messageData?.key;
      const message = payload.message || messageData?.message;
      
      console.log('🔍 Extracted key:', JSON.stringify(key, null, 2));
      
      // Extrair mídia da mensagem
      const mediaData = extractMediaFromMessage(message);
      const hasMedia = mediaData !== null;
      
      if (hasMedia) {
        console.log('📎 Media detected:', {
          type: mediaData!.type,
          mime_type: mediaData!.mime_type,
          has_caption: !!mediaData!.caption,
          has_base64: !!mediaData!.base64_data,
          has_thumbnail: !!mediaData!.thumbnail_base64,
        });
      }
      
      // Detectar se é mensagem de grupo
      const isGroupMessage = 
        payload.isGroup === true ||
        key?.remoteJid?.endsWith('@g.us');
      
      // Extrair informações do grupo se for mensagem de grupo
      let groupId: string | null = null;
      let groupName: string | null = null;
      
      if (isGroupMessage) {
        groupId = key?.remoteJid?.replace('@g.us', '') || null;
        // Tentar obter nome do grupo dos metadados
        groupName = payload.pushName || 
                    payload.data?.pushName || 
                    payload.groupMetadata?.subject || 
                    `Grupo ${groupId?.slice(-4) || 'Desconhecido'}`;
        console.log('📱 Processing GROUP message from:', groupId, '-', groupName);
      }
      
      // 🔍 DETECÇÃO MELHORADA DE MENSAGENS OUTBOUND
      // Detectar se é mensagem enviada pelo usuário conectado
      // Método 1: key.fromMe (padrão da API)
      // Método 2: Comparar participant com número conectado (para grupos)
      const connectedInstanceJid = payload.jid || '';
      const connectedNumber = connectedInstanceJid.replace(/@s\.whatsapp\.net$/g, '').replace(/\D/g, '');
      const participantJid = key?.participant || key?.remoteJid || '';
      const participantNumber = participantJid.replace(/@s\.whatsapp\.net$/g, '').replace(/@g\.us$/g, '').replace(/\D/g, '');
      
      // Verificar se é outbound por múltiplos métodos
      const fromMeFlag = key?.fromMe === true;
      const isParticipantConnected = connectedNumber && participantNumber && 
        (connectedNumber === participantNumber || 
         connectedNumber.endsWith(participantNumber) || 
         participantNumber.endsWith(connectedNumber));
      
      const isFromMe = fromMeFlag || isParticipantConnected;
      
      console.log('🔍 Outbound detection:', {
        fromMeFlag,
        connectedNumber,
        participantNumber,
        isParticipantConnected,
        isFromMe,
        isGroupMessage
      });
      
      if (isFromMe) {
        console.log('📱 Processing OUTBOUND message from mobile/web');
      }

      // Extract phone number - prioritize key.remoteJid for inbound messages
      // For received messages (fromMe: false), the sender is in key.remoteJid
      // payload.jid is the connected instance number
      const remoteJid = 
        key?.remoteJid ||                         // Priority 1: sender's number
        messageData?.key?.remoteJid ||            // Priority 2: fallback
        payload.jid ||                            // Priority 3: instance number (last resort)
        '';
      const phoneNumber = remoteJid
        .replace(/@s\.whatsapp\.net$/g, '')
        .replace(/@lid$/g, '')
        .replace(/\D/g, '');
      
      // === DETECTAR FORMATO DO TELEFONE RECEBIDO ===
      // O número recebido do WhatsApp representa o formato REAL usado pelo contato
      const detectPhoneFormat = (phone: string): 'with_nine' | 'without_nine' => {
        const digits = phone.replace(/\D/g, '');
        // Se tem 13 dígitos (55 + DDD + 9 + 8) e o 5º dígito é 9
        if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
          return 'with_nine';
        }
        return 'without_nine';
      };
      
      const detectedFormat = detectPhoneFormat(phoneNumber);
      console.log(`📱 Detected phone format: ${detectedFormat} for ${phoneNumber}`);
      
      // Normalize phone number - create ALL possible variations for flexible matching
      // WhatsApp sends: 555199050190 (country 55 + area 51 + 99050190)
      // Database may have: 51999050190, 5199050190, 999050190, etc.
      const phoneVariations: string[] = [];
      
      // Always add original
      phoneVariations.push(phoneNumber); // Ex: 555199050190
      
      // Remove country code 55 if present
      let withoutCountry = phoneNumber;
      if (phoneNumber.startsWith('55') && phoneNumber.length >= 12) {
        withoutCountry = phoneNumber.substring(2); // Ex: 5199050190
        phoneVariations.push(withoutCountry);
      }
      
      // Generate variations with/without leading 9 (mobile prefix)
      // Brazilian mobiles: DDD (2 digits) + 9 + number (8 digits) = 11 digits
      if (withoutCountry.length === 10) {
        // Has 10 digits: DDD + number without 9, add 9
        const area = withoutCountry.substring(0, 2);
        const number = withoutCountry.substring(2);
        phoneVariations.push(area + '9' + number); // Ex: 51 + 9 + 99050190 = 51999050190
      } else if (withoutCountry.length === 11 && withoutCountry.charAt(2) === '9') {
        // Has 11 digits with 9: DDD + 9 + number, also try without 9
        const area = withoutCountry.substring(0, 2);
        const number = withoutCountry.substring(3);
        phoneVariations.push(area + number); // Ex: 51 + 9050190 = 519050190
      }
      
      // Try just the last 8-9 digits (number without area code)
      if (withoutCountry.length >= 10) {
        phoneVariations.push(withoutCountry.substring(2)); // Remove DDD: 99050190 or 999050190
      }
      
      // Try with country code 55 added if not present
      if (!phoneNumber.startsWith('55')) {
        phoneVariations.push('55' + phoneNumber);
      }
      
      // Remove duplicates
      const uniqueVariations = [...new Set(phoneVariations)];
      
      console.log('📞 Phone variations for search:', uniqueVariations);

      // Extrair mensagem de texto - múltiplas fontes
      let messageText = '';
      
      if (message?.conversation) {
        messageText = message.conversation;
      } else if (message?.extendedTextMessage?.text) {
        messageText = message.extendedTextMessage.text;
      } else if (hasMedia) {
        // Para mídia, usar texto descritivo
        messageText = getMediaDisplayText(mediaData!);
      } else if (payload.text) {
        messageText = payload.text;
      } else {
        messageText = '[Mensagem recebida]';
      }

      console.log('📝 Processing inbound message:', { phoneNumber, messageText, hasMedia });

      // 🔍 IMPORTANTE: Buscar PRIMEIRO em customer_contacts, DEPOIS em carriers
      // Isso garante que clientes cadastrados sejam identificados corretamente
      console.log('🔍 Searching contacts with phone variations:', uniqueVariations);
      
      // Build OR query with all phone variations
      const orConditions = uniqueVariations
        .map(variation => `whatsapp.ilike.%${variation}%`)
        .join(',');
      
      let carrierId: string | null = null;
      let carrierName: string | null = null;
      let contactType = 'unknown';
      let customerId: string | null = null;
      let customerName: string | null = null;
      
      // ====== STEP 1: Buscar PRIMEIRO em customer_contacts ======
      console.log('🔍 Step 1: Searching customer_contacts FIRST...');
      
      const customerOrConditions = uniqueVariations
        .flatMap(variation => [
          `whatsapp.ilike.%${variation}%`,
          `phone.ilike.%${variation}%`
        ])
        .join(',');
      
      const { data: customer, error: customerError } = await supabase
        .from('customer_contacts')
        .select('id, customer_name, whatsapp, phone, last_order_id')
        .or(customerOrConditions)
        .maybeSingle();
      
      if (customerError) {
        console.error('Error finding customer:', customerError);
      }
      
      if (customer) {
        console.log('✅ Found CUSTOMER contact:', customer.customer_name);
        customerId = customer.id;
        customerName = customer.customer_name;
        contactType = 'customer';
        
        // Buscar ou criar carrier para o cliente
        const customerCarrierName = `Cliente: ${customer.customer_name}`;
        
        const { data: existingCarriers } = await supabase
          .from('carriers')
          .select('id, name, whatsapp')
          .or(orConditions);
        
        if (existingCarriers && existingCarriers.length > 0) {
          // Usar o carrier existente
          const existingCarrier = existingCarriers[0];
          carrierId = existingCarrier.id;
          carrierName = existingCarrier.name;
          
          // Atualizar nome do carrier se estava como "Contato XXXX" e atualizar phone_format
          if (existingCarrier.name.startsWith('Contato ') && existingCarrier.name !== customerCarrierName) {
            console.log('🔄 Updating carrier name from:', existingCarrier.name, 'to:', customerCarrierName);
            await supabase
              .from('carriers')
              .update({ name: customerCarrierName, phone_format: detectedFormat })
              .eq('id', existingCarrier.id);
            carrierName = customerCarrierName;
          } else {
            // Apenas atualizar phone_format se não estava definido
            await supabase
              .from('carriers')
              .update({ phone_format: detectedFormat })
              .eq('id', existingCarrier.id);
          }
          
          console.log('✅ Using existing carrier for customer:', existingCarrier.id, 'phone_format:', detectedFormat);
        } else {
          // Criar carrier para o cliente
          const normalizedPhone = uniqueVariations[0];
          const { data: newCarrier, error: createError } = await supabase
            .from('carriers')
            .insert({
              name: customerCarrierName,
              whatsapp: phoneNumber, // Salvar número ORIGINAL do WhatsApp
              phone_format: detectedFormat, // Salvar formato detectado
              is_active: true,
              notes: `Contato de cliente criado automaticamente - Customer ID: ${customer.id}`,
            })
            .select('id, name')
            .single();
          
          if (!createError && newCarrier) {
            carrierId = newCarrier.id;
            carrierName = newCarrier.name;
            console.log('✅ Created carrier for customer:', newCarrier.id);
          }
        }
      } else {
        // ====== STEP 1.5: Se não é cliente, verificar se é técnico ======
        console.log('🔍 Step 1.5: Customer not found, checking if technician...');
        
        const technicianOrConditions = uniqueVariations
          .map(variation => `phone.ilike.%${variation}%`)
          .join(',');
        
        const { data: technician, error: techError } = await supabase
          .from('technician_invites')
          .select('id, technician_name, phone, status')
          .eq('status', 'accepted')
          .or(technicianOrConditions)
          .maybeSingle();
        
        if (techError) {
          console.error('Error finding technician:', techError);
        }
        
        if (technician) {
          console.log('✅ Found TECHNICIAN contact:', technician.technician_name);
          contactType = 'technician';
          
          // Criar ou atualizar carrier para o técnico
          const technicianCarrierName = `Técnico: ${technician.technician_name}`;
          
          const { data: existingCarriers } = await supabase
            .from('carriers')
            .select('id, name, whatsapp')
            .or(orConditions);
          
          if (existingCarriers && existingCarriers.length > 0) {
            const existingCarrier = existingCarriers[0];
            carrierId = existingCarrier.id;
            carrierName = existingCarrier.name;
            
            // Atualizar nome do carrier se estava como "Contato XXXX" e atualizar phone_format
            if (existingCarrier.name.startsWith('Contato ') && existingCarrier.name !== technicianCarrierName) {
              console.log('🔄 Updating carrier name from:', existingCarrier.name, 'to:', technicianCarrierName);
              await supabase
                .from('carriers')
                .update({ name: technicianCarrierName, phone_format: detectedFormat })
                .eq('id', existingCarrier.id);
              carrierName = technicianCarrierName;
            } else {
              // Apenas atualizar phone_format se não estava definido
              await supabase
                .from('carriers')
                .update({ phone_format: detectedFormat })
                .eq('id', existingCarrier.id);
            }
            
            console.log('✅ Using existing carrier for technician:', existingCarrier.id, 'phone_format:', detectedFormat);
          } else {
            // Criar carrier para o técnico
            const normalizedPhone = uniqueVariations[0];
            const { data: newCarrier, error: createError } = await supabase
              .from('carriers')
            .insert({
              name: technicianCarrierName,
              whatsapp: phoneNumber, // Salvar número ORIGINAL do WhatsApp
              phone_format: detectedFormat, // Salvar formato detectado
              is_active: true,
              notes: `Contato de técnico criado automaticamente - Technician ID: ${technician.id}`,
            })
            .select('id, name')
            .single();
          
          if (!createError && newCarrier) {
            carrierId = newCarrier.id;
            carrierName = newCarrier.name;
            console.log('✅ Created carrier for technician:', newCarrier.id, 'phone_format:', detectedFormat);
          }
          }
        } else {
          // ====== STEP 2: Se não é cliente nem técnico, buscar em carriers (transportadoras) ======
          console.log('🔍 Step 2: Customer/technician not found, searching carriers...');
          
          const { data: carrierData, error: carrierError } = await supabase
            .from('carriers')
            .select('id, name, whatsapp')
            .or(orConditions);

          if (carrierError) {
            console.error('Error finding carrier:', carrierError);
          }
          
          if (carrierData && carrierData.length > 0) {
            // Verificar se é uma transportadora real ou um contato desconhecido
            const foundCarrier = carrierData.find(c => 
              uniqueVariations.some(v => c.whatsapp?.includes(v))
            ) || carrierData[0];
            
            carrierId = foundCarrier.id;
            carrierName = foundCarrier.name;
            
            // Atualizar phone_format para todos os carriers encontrados
            await supabase
              .from('carriers')
              .update({ phone_format: detectedFormat })
              .eq('id', foundCarrier.id);
            
            // Se o nome começa com "Contato ", "Cliente:" ou "Técnico:", identificar tipo
            if (foundCarrier.name.startsWith('Contato ')) {
              contactType = 'unknown';
              console.log(`⚠️ Found unidentified carrier: ${foundCarrier.name} (${foundCarrier.id}) phone_format: ${detectedFormat}`);
            } else if (foundCarrier.name.startsWith('Cliente:')) {
              contactType = 'customer';
              console.log(`✅ Found customer carrier: ${foundCarrier.name} (${foundCarrier.id}) phone_format: ${detectedFormat}`);
            } else if (foundCarrier.name.startsWith('Técnico:')) {
              contactType = 'technician';
              console.log(`✅ Found technician carrier: ${foundCarrier.name} (${foundCarrier.id}) phone_format: ${detectedFormat}`);
            } else {
              contactType = 'carrier';
              console.log(`✅ Found carrier: ${foundCarrier.name} (${foundCarrier.id}) phone_format: ${detectedFormat}`);
            }
          }
        }
      }
      
      // Se ainda não encontrou, criar contato desconhecido
      // MAS primeiro verificar novamente se não existe com qualquer variação
      if (!carrierId) {
        console.log('⚠️ Contact not found, double-checking before creating...');
        
        // Última tentativa de encontrar carrier existente
        const { data: lastCheckCarrier } = await supabase
          .from('carriers')
          .select('id, name')
          .or(orConditions)
          .limit(1)
          .maybeSingle();
        
        if (lastCheckCarrier) {
          carrierId = lastCheckCarrier.id;
          carrierName = lastCheckCarrier.name;
          console.log('✅ Found carrier on final check:', lastCheckCarrier.id);
        } else {
          // Realmente não existe, criar novo
          const unknownCarrierName = `Contato ${phoneNumber.slice(-4)}`;
          
          const { data: newCarrier, error: createError } = await supabase
            .from('carriers')
            .insert({
              name: unknownCarrierName,
              whatsapp: phoneNumber, // Salvar número ORIGINAL do WhatsApp
              phone_format: detectedFormat, // Salvar formato detectado
              is_active: true,
              notes: `Contato criado automaticamente via WhatsApp em ${new Date().toISOString()}`,
            })
            .select('id, name')
            .single();
          
          if (createError) {
            console.error('Error creating unknown carrier:', createError);
            contactType = 'unknown';
          } else {
            carrierId = newCarrier.id;
            carrierName = newCarrier.name;
            console.log('✅ Created new carrier for unknown contact:', newCarrier.id);
          }
        }
      }

      // Buscar última cotação ativa desta transportadora (opcional, apenas se temos carrier)
      let lastQuote: { id: string; order_id: string; status: string } | null = null;
      if (carrierId) {
        const { data: quote } = await supabase
          .from('freight_quotes')
          .select('id, order_id, status')
          .eq('carrier_id', carrierId)
          .in('status', ['sent', 'pending'])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        lastQuote = quote;
      }

      // Tentar extrair dados de cotação da mensagem (apenas texto)
      const quoteData = extractQuoteData(messageText);
      const hasQuoteData = quoteData.freight_value !== null || quoteData.delivery_time_days !== null;

      console.log('Extracted quote data:', quoteData, 'Has data:', hasQuoteData);

      let orderId = lastQuote?.order_id || null;

      // Se não encontrou cotação ativa, buscar última conversa (apenas se temos carrier)
      if (!orderId && carrierId) {
        const { data: lastConversation } = await supabase
          .from('carrier_conversations')
          .select('order_id')
          .eq('carrier_id', carrierId)
          .not('order_id', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        orderId = lastConversation?.order_id || null;
      }

      console.log('📦 Related order (optional):', orderId || 'none - general conversation');

      // Salvar mensagem recebida - SEMPRE, mesmo sem carrier (contactType = 'unknown')
      if (!carrierId) {
        console.log('⚠️ Skipping conversation save - no carrier ID available');
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: 'Message received but no carrier created',
            phoneNumber 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      // Verificar se é mensagem duplicada (evitar duplicatas de mensagens enviadas pelo sistema)
      if (isFromMe) {
        // Verificar se já existe uma mensagem outbound recente com mesmo conteúdo
        const { data: existingMsg } = await supabase
          .from('carrier_conversations')
          .select('id')
          .eq('carrier_id', carrierId)
          .eq('message_direction', 'outbound')
          .eq('message_content', messageText)
          .gte('created_at', new Date(Date.now() - 60000).toISOString()) // últimos 60 segundos
          .limit(1)
          .maybeSingle();
        
        if (existingMsg) {
          console.log('⏭️ Skipping duplicate outbound message');
          return new Response(
            JSON.stringify({ success: true, skipped: 'duplicate_outbound' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      // Inserir conversa com flags de mídia
      const { data: conversation, error: conversationError } = await supabase
        .from('carrier_conversations')
        .insert({
          carrier_id: carrierId,
          order_id: orderId,
          quote_id: lastQuote?.id || null,
          conversation_type: hasQuoteData ? 'quote_request' : 'general',
          message_direction: isFromMe ? 'outbound' : 'inbound',
          message_content: messageText,
          contact_type: contactType,
          is_group_message: isGroupMessage,
          group_id: groupId,
          group_name: groupName,
          has_media: hasMedia,
          media_type: hasMedia ? mediaData!.type : null,
          message_metadata: {
            received_via: 'mega_api',
            sent_via: isFromMe ? 'mobile_or_web' : null,
            phone_number: phoneNumber,
            mega_message_id: messageData.key?.id || null,
            message_timestamp: messageData.messageTimestamp,
            extracted_quote_data: hasQuoteData ? quoteData : null,
            auto_created_carrier: contactType === 'unknown',
            is_group: isGroupMessage,
            group_id: groupId,
            group_name: groupName,
            has_media: hasMedia,
            media_type: hasMedia ? mediaData!.type : null,
            media_caption: hasMedia ? mediaData!.caption : null,
          },
          sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (conversationError) {
        console.error('Error saving conversation:', conversationError);
        throw conversationError;
      }

      console.log('✅ Conversation saved:', conversation.id);

      // Salvar mídia se houver
      let savedMedia = null;
      if (hasMedia && conversation.id) {
        savedMedia = await saveMediaToDatabase(supabase, conversation.id, mediaData!);
        
        if (savedMedia) {
          console.log('📎 Media saved with ID:', savedMedia.id);
        }
      }

      // Se detectou dados de cotação E há cotação ativa, criar resposta automaticamente
      if (hasQuoteData && lastQuote) {
        console.log('Creating automatic quote response for quote:', lastQuote.id);

        const { error: responseError } = await supabase
          .from('freight_quote_responses')
          .insert({
            quote_id: lastQuote.id,
            freight_value: quoteData.freight_value,
            delivery_time_days: quoteData.delivery_time_days,
            response_text: messageText,
            additional_info: {
              auto_extracted: true,
              source: 'whatsapp_mega_api',
              phone_number: phoneNumber,
            },
            received_at: new Date().toISOString(),
          });

        if (responseError) {
          console.error('Error creating quote response:', responseError);
        } else {
          // Atualizar status da cotação para 'responded'
          await supabase
            .from('freight_quotes')
            .update({ 
              status: 'responded',
              response_received_at: new Date().toISOString()
            })
            .eq('id', lastQuote.id);

          console.log('✅ Quote response created successfully');
        }
      }

      // Salvar log de mensagem
      await supabase.from('whatsapp_message_log').insert({
        conversation_id: conversation.id,
        mega_message_id: messageData.key?.id || null,
        status: 'received',
      });

      console.log('✅ Message saved successfully:', conversation.id);

      // 🛑 CRITICAL FIX: Skip ALL AI agent processing for outbound messages
      // Mensagens enviadas pelo sistema (notificações) NÃO devem acionar agentes
      // Isso previne o loop onde o sistema responde a suas próprias mensagens
      if (isFromMe) {
        console.log('⏭️ [OUTBOUND] Skipping AI agent processing for outbound message');
        console.log('📝 Outbound messages are saved but NOT processed by AI agents');
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            conversationId: conversation.id,
            carrierId: carrierId,
            skipped: 'outbound_message',
            reason: 'Outbound messages do not trigger AI agent responses',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // 🚚 CHECK FOR DELIVERY CONFIRMATION RESPONSE
      // Detect if this is a response to delivery confirmation (SIM/NÃO)
      const deliveryResponsePatterns = [
        /^sim$/i, /^s$/i, /^yes$/i, /^y$/i, /^recebi$/i, /^recebido$/i, /^chegou$/i, /^ok$/i, /^✅$/, /^👍$/,
        /^n[aã]o$/i, /^n$/i, /^no$/i, /^nao recebi$/i, /^não recebi$/i, /^n[aã]o chegou$/i, /^ainda n[aã]o$/i, /^❌$/, /^👎$/,
      ];
      
      const isDeliveryResponse = deliveryResponsePatterns.some(p => p.test(messageText.trim()));
      
      if (isDeliveryResponse && contactType === 'customer') {
        console.log('📦 Detected potential DELIVERY CONFIRMATION response:', messageText);
        
        // Call process-delivery-response to handle it
        try {
          const deliveryResponseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-delivery-response`;
          const deliveryResponse = await fetch(deliveryResponseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              sender_phone: phoneNumber,
              message_content: messageText,
              conversation_id: conversation.id,
            }),
          });
          
          const deliveryResult = await deliveryResponse.json();
          console.log('📦 Delivery confirmation result:', deliveryResult);
          
          if (deliveryResult.success && deliveryResult.response_type !== 'invalid_response') {
            // Successfully processed as delivery confirmation - skip other AI agents
            return new Response(
              JSON.stringify({ 
                success: true, 
                conversationId: conversation.id,
                carrierId: carrierId,
                processedAs: 'delivery_confirmation',
                responseType: deliveryResult.response_type,
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            );
          }
        } catch (err) {
          console.error('📦 Error processing delivery confirmation:', err);
          // Continue to normal flow if error
        }
      }

      // 🤖 VERIFICAR SE É GESTOR - Resposta instantânea sem debounce
      // Gestores cadastrados em management_report_recipients recebem respostas imediatas
      console.log('🔍 [DIAGNOSTIC] Checking if sender is manager:', phoneNumber);
      const isManager = await checkIfManager(supabase, phoneNumber);
      console.log('🔍 [DIAGNOSTIC] isManager result:', isManager);
      
      // 🤖 DEBOUNCE: Adicionar mensagem ao buffer ao invés de responder imediatamente
      // ⚠️ SKIP GROUPS - Only respond to individual contacts (economia de tokens)
      // O processo de debounce aguarda 5 segundos para agrupar mensagens rápidas
      const DEBOUNCE_DELAY_MS = 5000; // 5 segundos
      
      if (isGroupMessage) {
        console.log('⏭️ Skipping AI Agent for group message:', groupName || groupId || 'unknown group');
        console.log('📝 Group messages are saved but NOT auto-replied to (token economy)');
      } else if (isManager) {
        // 👔 GESTOR: Resposta instantânea via ai-agent-manager-query
        // Gestores são roteados mesmo sem carrierId
        console.log('👔 [DIAGNOSTIC] Manager detected! Routing to manager query handler...');
        console.log('👔 [DIAGNOSTIC] Message:', messageText);
        console.log('👔 [DIAGNOSTIC] Phone:', phoneNumber);
        console.log('👔 [DIAGNOSTIC] CarrierId:', carrierId || 'NULL (manager without carrier)');
        
        try {
          const managerQueryUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent-manager-query`;
          console.log('👔 [DIAGNOSTIC] Calling:', managerQueryUrl);
          
          const response = await fetch(managerQueryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              message: messageText,
              senderPhone: phoneNumber,
              carrierId: carrierId || null, // Permitir null para gestores
            }),
          });
          
          const responseText = await response.text();
          console.log('👔 [DIAGNOSTIC] Manager query response status:', response.status);
          console.log('👔 [DIAGNOSTIC] Manager query response:', responseText.substring(0, 500));
          
          if (response.ok) {
            try {
              const result = JSON.parse(responseText);
              console.log('✅ Manager query processed:', result.intent);
              
              // Verificar se houve erro de instância não conectada
              if (result.error === 'NO_WHATSAPP_INSTANCE') {
                console.error('❌ [DIAGNOSTIC] CRITICAL: WhatsApp instance not connected!');
                console.error('❌ [DIAGNOSTIC] Diagnostic:', result.diagnostic);
              }
            } catch (parseErr) {
              console.log('✅ Manager query processed (non-JSON response)');
            }
          } else {
            console.error('❌ [DIAGNOSTIC] Manager query failed:', response.status, responseText);
          }
        } catch (err) {
          console.error('❌ [DIAGNOSTIC] Manager query error:', err);
        }
      } else if (carrierId) {
        try {
          console.log('🕐 Adding message to debounce buffer for:', contactType);
          
          // Buscar número da instância conectada (receiver_phone)
          const { data: connectedInstance } = await supabase
            .from('whatsapp_instances')
            .select('phone_number')
            .eq('status', 'connected')
            .limit(1)
            .maybeSingle();
          
          const receiverPhone = connectedInstance?.phone_number || null;
          
          // Verificar se já existe buffer pendente para este contato
          const { data: existingBuffer } = await supabase
            .from('pending_ai_replies')
            .select('*')
            .eq('carrier_id', carrierId)
            .eq('sender_phone', phoneNumber)
            .is('processed_at', null)
            .maybeSingle();
          
          const messageEntry = {
            content: messageText,
            timestamp: new Date().toISOString(),
            has_media: hasMedia,
            media_type: hasMedia ? mediaData!.type : null,
            conversation_id: conversation.id,
          };
          
          if (existingBuffer) {
            // Adicionar ao buffer existente e estender tempo de debounce
            const updatedBuffer = [...(existingBuffer.messages_buffer as any[]), messageEntry];
            const updatedConversationIds = [...(existingBuffer.conversation_ids || []), conversation.id];
            
            await supabase
              .from('pending_ai_replies')
              .update({
                messages_buffer: updatedBuffer,
                conversation_ids: updatedConversationIds,
                scheduled_reply_at: new Date(Date.now() + DEBOUNCE_DELAY_MS).toISOString(),
              })
              .eq('id', existingBuffer.id);
            
            console.log(`📬 Added to existing buffer (now ${updatedBuffer.length} messages), reply in ${DEBOUNCE_DELAY_MS}ms`);
          } else {
            // Criar novo buffer
            const { data: newBuffer, error: insertError } = await supabase
              .from('pending_ai_replies')
              .insert({
                carrier_id: carrierId,
                sender_phone: phoneNumber,
                receiver_phone: receiverPhone,
                contact_type: contactType,
                messages_buffer: [messageEntry],
                conversation_ids: [conversation.id],
                first_message_at: new Date().toISOString(),
                scheduled_reply_at: new Date(Date.now() + DEBOUNCE_DELAY_MS).toISOString(),
              })
              .select()
              .single();
            
            if (insertError) {
              console.error('❌ Failed to insert pending_ai_reply:', insertError);
              throw insertError;
            }
            
            console.log(`📬 Created new debounce buffer ID: ${newBuffer?.id}, reply scheduled in ${DEBOUNCE_DELAY_MS}ms`);
          }
          
          // Disparar processamento após o delay (fire and forget)
          // Isso garante que mesmo sem cron, as mensagens serão processadas
          setTimeout(async () => {
            try {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-pending-replies`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({ trigger: 'debounce_timeout' }),
              });
            } catch (err) {
              console.error('🕐 Failed to trigger process-pending-replies:', err);
            }
          }, DEBOUNCE_DELAY_MS + 500); // +500ms de margem
          
        } catch (debounceError) {
          console.error('🕐 Failed to add to debounce buffer:', debounceError);
          // Fallback: responder imediatamente se o debounce falhar
          console.log('⚠️ Falling back to immediate reply...');
          
          const functionName = (contactType === 'customer' || contactType === 'technician')
            ? 'ai-agent-logistics-reply' 
            : 'ai-agent-auto-reply';
          
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              // Use correct field names expected by the agents
              message: messageText,
              from_phone: phoneNumber,
              carrier_id: carrierId,
              conversation_id: conversation.id,
              contact_type: contactType,
              is_fallback: true,
            }),
          }).catch(err => console.error('🤖 Fallback auto-reply error:', err));
        }
      }

      // 📊 Trigger sentiment analysis in background (fire and forget)
      // ⚠️ SKIP GROUPS - Only analyze individual conversations (token economy)
      // Only analyze if we have enough messages (3+) or it's been a while since last analysis
      if (isGroupMessage) {
        console.log('⏭️ Skipping sentiment analysis for group message');
      } else {
        try {
          // Check if we should analyze
          const { data: cachedSentiment } = await supabase
            .from('conversation_sentiment_cache')
            .select('last_analyzed_at, message_count')
            .eq('carrier_id', carrierId)
            .maybeSingle();

          const shouldAnalyze = !cachedSentiment || 
            !cachedSentiment.last_analyzed_at ||
            (new Date().getTime() - new Date(cachedSentiment.last_analyzed_at).getTime() > 5 * 60 * 1000); // 5 min

          if (shouldAnalyze && carrierId) {
            console.log('📊 Triggering sentiment analysis...');
            
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent-conversation-summary`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                carrierId: carrierId,
                contactName: carrierName || 'Contato desconhecido',
              }),
            }).then(async (res) => {
              const result = await res.json();
              console.log('📊 Sentiment analysis result:', result.sentiment, result.score);
            }).catch((err) => {
              console.error('📊 Sentiment analysis error:', err);
            });
          }
        } catch (sentimentError) {
          console.error('📊 Failed to trigger sentiment analysis:', sentimentError);
          // Don't throw - sentiment failure shouldn't break webhook
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          conversationId: conversation.id,
          carrierId: carrierId,
          carrierName: carrierName,
          orderId: orderId,
          contactType: contactType,
          autoCreatedCarrier: contactType === 'unknown',
          quoteResponseCreated: hasQuoteData && !!lastQuote,
          hasMedia: hasMedia,
          mediaType: hasMedia ? mediaData!.type : null,
          mediaId: savedMedia?.id || null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else if (payload.event === 'connection.update' || payload.messageType === 'connection_update') {
      console.log('Connection update received');
      
      const connectionData = payload.data || {};
      const connectionMessage = payload.message || connectionData.message;
      
      // Detectar desconexão explícita (logout) - capturar mais cenários
      const closeReason = connectionData.closeReason || payload.closeReason || connectionMessage;
      
      // === CRITICAL FIX: Separate true manual logout from API disconnection ===
      // "Number disconnected from api" is NOT a manual logout - it's usually session conflict or API instability
      const isManualLogout = 
        connectionMessage === 'logout' ||
        closeReason === 'logout';
        
      const isApiDisconnection = 
        connectionMessage === 'Number disconnected from api' ||
        closeReason === 'connectionClosed' ||
        closeReason === 'timedOut' ||
        connectionData.connection === 'close';
      
      const isLogout = isManualLogout || isApiDisconnection;
      
      const isConnected = !isLogout && (
        connectionMessage === 'phone_connected' ||
        connectionData.state === 'open' ||
        connectionData.connection === 'open' ||
        payload.status === 'connected'
      );
      
      const phoneFromJid = payload.jid?.replace('@s.whatsapp.net', '').replace('@lid', '') || 
        connectionData.phoneNumber || 
        payload.phoneNumber || 
        null;
      
      // Determinar causa provável da desconexão - with corrected classification
      let disconnectCause = 'unknown';
      if (isLogout) {
        if (isManualLogout) {
          // Only true manual logout from mobile app
          disconnectCause = 'manual_logout';
        } else if (connectionMessage === 'Number disconnected from api') {
          // API disconnection - NOT manual logout (usually session conflict or API instability)
          disconnectCause = 'api_disconnection';
        } else if (closeReason === 'connectionClosed') {
          disconnectCause = 'session_conflict';
        } else if (closeReason === 'timedOut') {
          disconnectCause = 'timeout';
        } else if (connectionData.connection === 'close') {
          disconnectCause = 'connection_closed';
        }
      }
      
      console.log('📱 Connection details:', {
        isConnected,
        isLogout,
        phoneNumber: phoneFromJid,
        closeReason: closeReason,
        disconnectCause: disconnectCause,
        rawMessage: connectionMessage,
      });
      
      // ⚠️ Log detalhado para desconexões
      if (isLogout) {
        console.log('⚠️ DISCONNECTION DETECTED:', {
          closeReason: closeReason,
          message: connectionMessage,
          cause: disconnectCause,
          isManualLogout: isManualLogout,
          isApiDisconnection: isApiDisconnection,
          timestamp: new Date().toISOString(),
          possibleCauses: [
            disconnectCause === 'api_disconnection' ? '🟠 Desconexão pela MEGA API (instabilidade ou reinício)' : null,
            disconnectCause === 'session_conflict' ? '🔴 WhatsApp Web aberto em outro navegador ou dispositivo' : null,
            disconnectCause === 'manual_logout' ? '🔴 Desconexão manual pelo app do celular (confirmado)' : null,
            disconnectCause === 'timeout' ? '🟠 Sessão expirada por inatividade' : null,
            disconnectCause === 'connection_closed' ? '🟠 Conexão encerrada pelo servidor' : null,
          ].filter(Boolean)
        });
      }
      
      // Atualizar status da instância
      await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: instanceKey,
          status: isConnected ? 'connected' : (isLogout ? 'disconnected' : 'waiting_scan'),
          phone_number: isConnected ? phoneFromJid : null,
          connected_at: isConnected ? new Date().toISOString() : null,
          qrcode: isConnected ? null : undefined,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'instance_key' });
      
      console.log('Instance status updated successfully');
      
      // 📊 Logar evento de conexão na tabela ai_notification_log para histórico
      const connectionEventStatus = isConnected ? 'connected' : (isLogout ? 'disconnected' : 'waiting_scan');
      
      // Mensagem mais descritiva baseada na causa
      let eventDescription = '';
      if (isConnected) {
        eventDescription = `WhatsApp conectado${phoneFromJid ? ` - Número: ${phoneFromJid}` : ''}`;
      } else if (isLogout) {
        const causeLabels: Record<string, string> = {
          'manual_logout': 'Deslogado manualmente pelo app do celular',
          'api_disconnection': 'Desconexão pela MEGA API (instabilidade ou conflito)',
          'session_conflict': 'Conflito de sessão (outra instância ou WhatsApp Web)',
          'timeout': 'Sessão expirada por inatividade',
          'connection_closed': 'Conexão encerrada pelo servidor',
          'unknown': closeReason || 'Motivo desconhecido'
        };
        eventDescription = `WhatsApp desconectado - ${causeLabels[disconnectCause] || causeLabels.unknown}`;
      } else {
        eventDescription = 'WhatsApp aguardando QR Code';
      }
      
      await supabase.from('ai_notification_log').insert({
        channel: 'whatsapp_connection',
        recipient: 'system',
        status: connectionEventStatus,
        message_content: eventDescription,
        error_message: isLogout ? `Causa: ${disconnectCause}` : null,
        metadata: { 
          event: 'connection.update',
          instance_key: instanceKey,
          phone_number: phoneFromJid,
          connection_state: connectionData.state || connectionData.connection,
          close_reason: closeReason,
          disconnect_cause: disconnectCause,
          is_logout: isLogout,
          raw_message: connectionMessage,
          timestamp: new Date().toISOString(),
          troubleshooting: isLogout ? [
            'Verifique se há outra sessão do WhatsApp Web aberta',
            'Verifique se outra instância está usando este número',
            'Evite desconectar pelo app do celular',
            'Reconecte escaneando um novo QR Code'
          ] : null
        }
      });
      
      console.log('✅ Connection event logged to ai_notification_log');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          event: 'connection.update', 
          isConnected, 
          isLogout,
          disconnectCause: isLogout ? disconnectCause : null 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event: payload.event }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mega-api-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

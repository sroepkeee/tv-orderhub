// Módulo compartilhado para envio de mensagens WhatsApp
// Reutilizável por múltiplas edge functions

export const DELAY_BETWEEN_SENDS_MS = 3000;
export const MIN_CONNECTION_AGE_MS = 60000;

export const delayMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== VALIDAÇÃO DE TOKEN ====================

/**
 * Verifica se o token é um placeholder (não real)
 */
export function isPlaceholderToken(token: string | null | undefined): boolean {
  if (!token || token.trim() === '') return true;
  const placeholders = ['SEU_TOKEN', 'API_KEY', 'YOUR_TOKEN', 'TOKEN_AQUI', 'PLACEHOLDER', 'XXX', 'EXEMPLO'];
  return placeholders.some(p => token.toUpperCase().includes(p));
}

/**
 * Obtém o melhor token disponível (banco ou env), ignorando placeholders
 */
export function getEffectiveToken(dbToken: string | null | undefined): string {
  // Se token do banco existe e não é placeholder, usar
  if (dbToken && !isPlaceholderToken(dbToken)) {
    console.log('🔑 Using database token');
    return dbToken;
  }
  
  // Fallback para env
  const envToken = Deno.env.get('MEGA_API_TOKEN') || '';
  if (envToken && !isPlaceholderToken(envToken)) {
    console.log('🔑 Database token invalid, using MEGA_API_TOKEN from env');
    return envToken;
  }
  
  console.error('❌ No valid token available (db or env)');
  return '';
}

// ==================== INSTÂNCIA ====================

export async function getActiveWhatsAppInstance(supabaseClient: any): Promise<{
  instance_key: string;
  api_token?: string;
  status: string;
  connected_at?: string;
} | null> {
  // Prioridade 1: Instância conectada
  let { data: instance } = await supabaseClient
    .from('whatsapp_instances')
    .select('instance_key, api_token, status, connected_at')
    .eq('status', 'connected')
    .eq('is_active', true)
    .maybeSingle();

  // Prioridade 2: Fallback para instância ativa
  if (!instance) {
    const { data: fallback } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key, api_token, status, connected_at')
      .eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .maybeSingle();
    instance = fallback;
  }

  return instance;
}

// ==================== NORMALIZAÇÃO DE TELEFONE ====================

/**
 * Normaliza número de telefone brasileiro para formato canônico (sem formatação)
 * Lida com diversos formatos de entrada: +55, 0055, 055, etc.
 * Retorna apenas dígitos com DDI 55
 */
export function normalizePhoneCanonical(phone: string): string {
  let phoneNumber = phone.replace(/\D/g, '');
  
  // Remover prefixos internacionais duplicados ou variantes
  if (phoneNumber.startsWith('0055')) {
    phoneNumber = phoneNumber.substring(2); // Remove "00"
  } else if (phoneNumber.startsWith('055') && phoneNumber.length > 12) {
    phoneNumber = phoneNumber.substring(1); // Remove "0" extra
  }
  
  // Adicionar DDI se não existir
  if (!phoneNumber.startsWith('55')) {
    phoneNumber = `55${phoneNumber}`;
  }
  
  return phoneNumber;
}

/**
 * Gera variantes do número brasileiro:
 * - Formato SEM 9 adicional (preferido pelo WhatsApp oficial): 55DDXXXXXXXX (12 dígitos)
 * - Formato COM 9 adicional (legado): 55DD9XXXXXXXX (13 dígitos)
 * 
 * @param phone Número em qualquer formato
 * @param preferWithoutNine Se true, retorna variante sem 9 primeiro (padrão: true)
 */
export function getPhoneVariants(phone: string, preferWithoutNine = true): string[] {
  const canonical = normalizePhoneCanonical(phone);
  const variants: string[] = [];
  
  // Identificar formato atual
  if (canonical.length === 13 && canonical.startsWith('55') && canonical.charAt(4) === '9') {
    // Tem 13 dígitos COM o 9 extra (55 + DD + 9 + 8)
    const ddd = canonical.substring(2, 4);
    const numero = canonical.substring(5); // 8 dígitos após o 9
    const withoutNine = '55' + ddd + numero; // 12 dígitos
    const withNine = canonical; // 13 dígitos
    
    if (preferWithoutNine) {
      variants.push(withoutNine, withNine);
    } else {
      variants.push(withNine, withoutNine);
    }
  } else if (canonical.length === 12 && canonical.startsWith('55')) {
    // Tem 12 dígitos SEM o 9 extra (55 + DD + 8)
    const ddd = canonical.substring(2, 4);
    const numero = canonical.substring(4); // 8 dígitos
    const withoutNine = canonical; // 12 dígitos
    const withNine = '55' + ddd + '9' + numero; // 13 dígitos
    
    if (preferWithoutNine) {
      variants.push(withoutNine, withNine);
    } else {
      variants.push(withNine, withoutNine);
    }
  } else {
    // Outro formato - usar como está
    variants.push(canonical);
  }
  
  return variants;
}

/**
 * @deprecated Use getPhoneVariants() para suporte a fallback
 * Mantido para compatibilidade
 */
export function normalizePhoneNumber(phone: string): string {
  const variants = getPhoneVariants(phone, true);
  return variants[0];
}

// ==================== MULTI-HEADER AUTH ====================

/**
 * Tenta enviar com múltiplos formatos de header de autenticação
 * Ordem: apikey, Authorization: Bearer, Apikey
 */
async function tryMultiHeaderFetch(
  url: string,
  token: string,
  body: any,
  method: 'POST' | 'GET' = 'POST'
): Promise<Response | null> {
  const headerTypes = ['apikey', 'Bearer', 'Apikey'];
  
  for (const headerType of headerTypes) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (headerType === 'apikey') {
      headers['apikey'] = token;
    } else if (headerType === 'Bearer') {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Apikey'] = token;
    }
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      });
      
      // Se sucesso, retornar
      if (response.ok) {
        console.log(`✅ Success with header format: ${headerType}`);
        return response;
      }
      
      // Se 401/403, tentar próximo formato
      if (response.status === 401 || response.status === 403) {
        console.log(`🔄 Auth failed with ${headerType} (${response.status}), trying next...`);
        continue;
      }
      
      // Outros erros, retornar para análise
      return response;
    } catch (err) {
      console.error(`❌ Fetch error with ${headerType}:`, err);
      continue;
    }
  }
  
  return null;
}

// ==================== ENVIO DE MENSAGEM ====================

export async function sendWhatsAppMessage(
  supabaseClient: any, 
  phone: string, 
  message: string,
  options?: {
    preferWithoutNine?: boolean;
    tryFallback?: boolean;
  }
): Promise<boolean> {
  const preferWithoutNine = options?.preferWithoutNine ?? true;
  const tryFallback = options?.tryFallback ?? true;
  
  try {
    const activeInstance = await getActiveWhatsAppInstance(supabaseClient);
    
    if (!activeInstance) {
      console.error('❌ No active WhatsApp instance found');
      return false;
    }

    // Obter token efetivo (banco ou env, ignorando placeholders)
    const token = getEffectiveToken(activeInstance.api_token);
    if (!token) {
      console.error('❌ No valid API token available');
      return false;
    }

    const variants = getPhoneVariants(phone, preferWithoutNine);
    
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/text`;

    // Tentar cada variante do telefone
    for (let i = 0; i < variants.length; i++) {
      const phoneNumber = variants[i];
      const isLastVariant = i === variants.length - 1;
      
      console.log(`📤 Sending WhatsApp to ${phoneNumber} via ${activeInstance.instance_key} (variant ${i + 1}/${variants.length})`);

      const body = {
        messageData: {
          to: phoneNumber,
          text: message,
          linkPreview: false,
        }
      };

      // Tentar com múltiplos headers
      const response = await tryMultiHeaderFetch(`${megaApiUrl}${endpoint}`, token, body);
      
      if (response?.ok) {
        console.log('✅ WhatsApp message sent to:', phoneNumber);
        return true;
      }

      if (response) {
        const errorText = await response.text();
        console.log(`❌ Mega API error for ${phoneNumber}: ${response.status} - ${errorText.substring(0, 200)}`);
        
        // Se erro 400/404 (número inválido) e temos fallback, tentar próxima variante
        if ((response.status === 400 || response.status === 404) && !isLastVariant && tryFallback) {
          console.log(`🔄 Number format issue, trying next variant...`);
          await delayMs(500);
          continue;
        }
        
        // Para erros de autenticação após tentar todos os headers
        if (response.status === 401 || response.status === 403) {
          console.error('❌ Authentication failed with all header formats');
          return false;
        }
      } else {
        console.error(`❌ All header formats failed for ${phoneNumber}`);
      }
      
      // Se for última variante ou erro não recuperável
      if (isLastVariant) {
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return false;
  }
}

export async function sendWhatsAppImage(
  supabaseClient: any, 
  phone: string, 
  base64Data: string, 
  caption: string,
  options?: {
    preferWithoutNine?: boolean;
    tryFallback?: boolean;
  }
): Promise<boolean> {
  const preferWithoutNine = options?.preferWithoutNine ?? true;
  const tryFallback = options?.tryFallback ?? true;
  
  try {
    const activeInstance = await getActiveWhatsAppInstance(supabaseClient);
    
    if (!activeInstance) {
      console.error('❌ No active WhatsApp instance for image send');
      return false;
    }

    // Obter token efetivo
    const token = getEffectiveToken(activeInstance.api_token);
    if (!token) {
      console.error('❌ No valid API token available for image');
      return false;
    }

    const variants = getPhoneVariants(phone, preferWithoutNine);

    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/image`;

    for (let i = 0; i < variants.length; i++) {
      const phoneNumber = variants[i];
      const isLastVariant = i === variants.length - 1;
      
      const body = {
        messageData: {
          to: phoneNumber,
          image: `data:image/png;base64,${base64Data}`,
          caption: caption,
        }
      };

      const response = await tryMultiHeaderFetch(`${megaApiUrl}${endpoint}`, token, body);

      if (response?.ok) {
        console.log('✅ WhatsApp image sent to:', phoneNumber);
        return true;
      }

      if (response) {
        const errorText = await response.text();
        console.log(`❌ Mega API image error for ${phoneNumber}: ${response.status} - ${errorText.substring(0, 200)}`);
        
        if ((response.status === 400 || response.status === 404) && !isLastVariant && tryFallback) {
          console.log(`🔄 Number format issue for image, trying next variant...`);
          await delayMs(500);
          continue;
        }
        
        if (response.status === 401 || response.status === 403) {
          return false;
        }
      }
      
      if (isLastVariant) {
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp image:', error);
    return false;
  }
}

// ==================== STATUS CHECK ====================

/**
 * Verifica status da conexão WhatsApp com múltiplos endpoints e headers (fallback)
 * Retorna status real se disponível, ou 'unverifiable' se API não responder
 */
export async function checkConnectionStatus(
  instanceKey: string,
  apiToken?: string
): Promise<{
  connected: boolean;
  status: 'connected' | 'disconnected' | 'waiting_scan' | 'unverifiable';
  error?: string;
}> {
  let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
  if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
    megaApiUrl = `https://${megaApiUrl}`;
  }
  megaApiUrl = megaApiUrl.replace(/\/+$/, '');
  
  // Obter token efetivo
  const token = getEffectiveToken(apiToken);
  
  if (!token) {
    return { connected: false, status: 'disconnected', error: 'no_valid_token' };
  }
  
  // Endpoints a tentar (em ordem)
  const endpoints = [
    `/rest/instance/connectionState/${instanceKey}`,
    `/instance/connectionState/${instanceKey}`,
    `/rest/status/${instanceKey}`,
    `/status/${instanceKey}`,
  ];
  
  // Headers a tentar (em ordem)
  const headerTypes = ['apikey', 'Bearer', 'Apikey'];
  
  for (const endpoint of endpoints) {
    for (const headerType of headerTypes) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (headerType === 'apikey') {
        headers['apikey'] = token;
      } else if (headerType === 'Bearer') {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['Apikey'] = token;
      }
      
      try {
        const response = await fetch(`${megaApiUrl}${endpoint}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8000),
        });
        
        // 404 = endpoint não existe, tentar próximo
        if (response.status === 404) {
          break; // Próximo endpoint
        }
        
        // 401/403 = problema de autenticação com este header, tentar próximo
        if (response.status === 401 || response.status === 403) {
          continue; // Próximo header
        }
        
        if (response.ok) {
          const data = await response.json();
          const state = data.state || data.status || data.connectionState;
          
          if (state === 'open' || state === 'connected' || data.connected === true) {
            return { connected: true, status: 'connected' };
          } else if (state === 'close' || state === 'disconnected') {
            return { connected: false, status: 'disconnected' };
          } else {
            return { connected: false, status: 'waiting_scan' };
          }
        }
      } catch (err) {
        // Timeout ou erro de rede - tentar próximo
        continue;
      }
    }
  }
  
  // Nenhum endpoint/header funcionou
  console.log('⚠️ All status endpoints failed - status unverifiable');
  return { connected: false, status: 'unverifiable', error: 'all_endpoints_failed' };
}

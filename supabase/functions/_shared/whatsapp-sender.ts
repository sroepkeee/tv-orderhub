// Módulo compartilhado para envio de mensagens WhatsApp
// Reutilizável por múltiplas edge functions

export const DELAY_BETWEEN_SENDS_MS = 3000;
export const MIN_CONNECTION_AGE_MS = 60000;

export const delayMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export function normalizePhoneNumber(phone: string): string {
  let phoneNumber = phone.replace(/\D/g, '');
  if (!phoneNumber.startsWith('55')) {
    phoneNumber = `55${phoneNumber}`;
  }
  // Se tem apenas 12 dígitos, adicionar o 9
  if (phoneNumber.length === 12 && phoneNumber.startsWith('55')) {
    const ddd = phoneNumber.substring(2, 4);
    const numero = phoneNumber.substring(4);
    phoneNumber = '55' + ddd + '9' + numero;
  }
  return phoneNumber;
}

export async function sendWhatsAppMessage(
  supabaseClient: any, 
  phone: string, 
  message: string
): Promise<boolean> {
  try {
    const activeInstance = await getActiveWhatsAppInstance(supabaseClient);
    
    if (!activeInstance) {
      console.error('❌ No active WhatsApp instance found');
      return false;
    }

    const phoneNumber = normalizePhoneNumber(phone);
    
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const megaApiToken = activeInstance.api_token || Deno.env.get('MEGA_API_TOKEN') || '';
    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/text`;

    console.log(`📤 Sending WhatsApp to ${phoneNumber} via ${activeInstance.instance_key}`);

    const response = await fetch(`${megaApiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': megaApiToken,
      },
      body: JSON.stringify({
        messageData: {
          to: phoneNumber,
          text: message,
          linkPreview: false,
        }
      }),
    });

    if (response.ok) {
      console.log('✅ WhatsApp message sent to:', phoneNumber);
      return true;
    }

    const errorText = await response.text();
    console.error(`❌ Mega API error: ${response.status} - ${errorText.substring(0, 200)}`);
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
  caption: string
): Promise<boolean> {
  try {
    const activeInstance = await getActiveWhatsAppInstance(supabaseClient);
    
    if (!activeInstance) {
      console.error('❌ No active WhatsApp instance for image send');
      return false;
    }

    let phoneNumber = phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = `55${phoneNumber}`;
    }

    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const megaApiToken = activeInstance.api_token || Deno.env.get('MEGA_API_TOKEN') || '';
    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/image`;

    const response = await fetch(`${megaApiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': megaApiToken,
      },
      body: JSON.stringify({
        messageData: {
          to: phoneNumber,
          image: `data:image/png;base64,${base64Data}`,
          caption: caption,
        }
      }),
    });

    if (response.ok) {
      console.log('✅ WhatsApp image sent to:', phoneNumber);
      return true;
    }

    const errorText = await response.text();
    console.error(`❌ Mega API image error: ${response.status} - ${errorText.substring(0, 200)}`);
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp image:', error);
    return false;
  }
}

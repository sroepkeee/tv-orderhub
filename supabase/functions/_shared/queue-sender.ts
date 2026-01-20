/**
 * 📬 Queue Sender - Utilitário centralizado para enfileirar mensagens WhatsApp
 * 
 * TODAS as mensagens automatizadas/em massa DEVEM passar por esta fila.
 * Isso garante:
 * - Rate limiting unificado
 * - Janela de envio
 * - Delay/jitter entre mensagens
 * - Retry com backoff
 * - Monitoramento centralizado
 */

export interface QueueMessageInput {
  recipientWhatsapp: string;
  recipientName?: string;
  messageType: string;
  messageContent: string;
  mediaBase64?: string | null;
  mediaCaption?: string | null;
  mediaFilename?: string | null;
  priority?: 1 | 2 | 3; // 1 = Crítico, 2 = Alto, 3 = Normal
  scheduledFor?: Date | string | null;
  metadata?: Record<string, any>;
  organizationId?: string | null;
  maxAttempts?: number;
}

export interface QueueResult {
  success: boolean;
  queueId?: string;
  error?: string;
}

// Prioridades padrão por tipo de mensagem
const MESSAGE_TYPE_PRIORITIES: Record<string, number> = {
  // Prioridade 1 - Crítico (enviar imediatamente)
  'customer_notification': 2,
  'status_change': 2,
  'order_created': 2,
  
  // Prioridade 2 - Alto
  'delivery_confirmation': 2,
  'delivery_confirmation_followup': 2,
  'manager_alert': 2,
  'phase_stall_alert': 2,
  
  // Prioridade 3 - Normal
  'daily_report': 3,
  'scheduled_report': 3,
  'scheduled_report_image': 3,
  'ai_auto_reply': 2,
  'manager_smart_alert': 2,
};

/**
 * Normaliza número de telefone brasileiro para formato canônico
 * Formato: 55 + DDD (2) + número (8 dígitos) = 12 dígitos
 */
export function normalizePhoneCanonical(phone: string): string {
  if (!phone) return phone;
  
  let digits = phone.replace(/\D/g, '');
  
  // Truncar se muito longo
  if (digits.length > 13) {
    digits = digits.slice(-13);
  }
  
  // Adicionar 55 se não tem
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Se tem 13 dígitos (55 + DDD + 9 + 8), REMOVER o 9
  if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
    const ddd = digits.substring(2, 4);
    const numero = digits.substring(5);
    digits = '55' + ddd + numero;
  }
  
  return digits;
}

/**
 * Enfileira uma mensagem para envio posterior
 */
export async function enqueueMessage(
  supabase: any,
  input: QueueMessageInput
): Promise<QueueResult> {
  try {
    const normalizedPhone = normalizePhoneCanonical(input.recipientWhatsapp);
    
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }
    
    const priority = input.priority ?? MESSAGE_TYPE_PRIORITIES[input.messageType] ?? 3;
    
    const { data, error } = await supabase
      .from('message_queue')
      .insert({
        recipient_whatsapp: normalizedPhone,
        recipient_name: input.recipientName || null,
        message_type: input.messageType,
        message_content: input.messageContent,
        media_base64: input.mediaBase64 || null,
        media_caption: input.mediaCaption || null,
        media_filename: input.mediaFilename || null,
        priority,
        status: 'pending',
        scheduled_for: input.scheduledFor || null,
        attempts: 0,
        max_attempts: input.maxAttempts ?? 3,
        organization_id: input.organizationId || null,
        metadata: {
          ...input.metadata,
          queued_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('❌ Error enqueuing message:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ Message queued: ${data.id} (type: ${input.messageType}, priority: ${priority})`);
    return { success: true, queueId: data.id };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception enqueuing message:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Enfileira múltiplas mensagens de uma vez
 */
export async function enqueueMessages(
  supabase: any,
  inputs: QueueMessageInput[]
): Promise<{ success: boolean; queued: number; failed: number; results: QueueResult[] }> {
  const results: QueueResult[] = [];
  let queued = 0;
  let failed = 0;
  
  for (const input of inputs) {
    const result = await enqueueMessage(supabase, input);
    results.push(result);
    
    if (result.success) {
      queued++;
    } else {
      failed++;
    }
  }
  
  return {
    success: failed === 0,
    queued,
    failed,
    results,
  };
}

/**
 * Cria entrada de log de notificação e enfileira a mensagem
 * Use para notificações que precisam de rastreamento em ai_notification_log
 */
export async function enqueueNotification(
  supabase: any,
  input: QueueMessageInput & {
    orderId?: string;
    customerContactId?: string;
    channel?: string;
    triggerType?: string;
    isTest?: boolean;
  }
): Promise<{ success: boolean; queueId?: string; logId?: string; error?: string }> {
  try {
    // 1. Criar log de notificação com status 'queued'
    const { data: logEntry, error: logError } = await supabase
      .from('ai_notification_log')
      .insert({
        order_id: input.orderId || null,
        customer_contact_id: input.customerContactId || null,
        channel: input.channel || 'whatsapp',
        recipient: normalizePhoneCanonical(input.recipientWhatsapp),
        message_content: input.messageContent,
        status: 'queued',
        metadata: {
          ...input.metadata,
          trigger_type: input.triggerType,
          is_test: input.isTest,
          message_type: input.messageType,
        },
      })
      .select('id')
      .single();
    
    if (logError) {
      console.error('❌ Error creating notification log:', logError);
      return { success: false, error: logError.message };
    }
    
    // 2. Enfileirar mensagem com referência ao log
    const queueResult = await enqueueMessage(supabase, {
      ...input,
      metadata: {
        ...input.metadata,
        notification_log_id: logEntry.id,
        trigger_type: input.triggerType,
        is_test: input.isTest,
      },
    });
    
    if (!queueResult.success) {
      // Atualizar log como falha
      await supabase
        .from('ai_notification_log')
        .update({ status: 'failed', error_message: queueResult.error })
        .eq('id', logEntry.id);
      
      return { success: false, logId: logEntry.id, error: queueResult.error };
    }
    
    // 3. Atualizar log com ID da fila
    await supabase
      .from('ai_notification_log')
      .update({ 
        metadata: {
          ...input.metadata,
          queue_id: queueResult.queueId,
          trigger_type: input.triggerType,
          is_test: input.isTest,
        }
      })
      .eq('id', logEntry.id);
    
    return {
      success: true,
      queueId: queueResult.queueId,
      logId: logEntry.id,
    };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in enqueueNotification:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

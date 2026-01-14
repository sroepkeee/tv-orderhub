-- Limpar schedule antigo de clientes (agora usa ai_agent_config.notification_phases)
DELETE FROM report_schedules 
WHERE recipient_type = 'customers';

-- Atualizar notificações pendentes antigas para expiradas
UPDATE phase_manager_notifications
SET status = 'expired', 
    error_message = 'Expirou sem ser enviada - fila não processada antes de correção'
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '7 days';

-- Atualizar mensagens antigas na fila para failed
UPDATE message_queue
SET status = 'failed',
    error_message = 'Expirou - fila não processada automaticamente antes de correção',
    updated_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '7 days';
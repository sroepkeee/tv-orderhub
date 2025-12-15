-- Activate Carrier AI agent config (Mega API auto-reply)
UPDATE public.ai_agent_config
SET is_active = true,
    auto_reply_enabled = true,
    updated_at = now()
WHERE id = 'fd5a85fe-232b-4dad-8a09-b68215ac7001';

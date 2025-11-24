-- Criar índices de performance para user_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON user_activity_log(action_type);

-- Criar índice para last_login em profiles
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login DESC);

-- Função para limpar logs antigos (>90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_activity_log 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Comentários para documentação
COMMENT ON FUNCTION cleanup_old_activity_logs IS 'Remove logs de atividade com mais de 90 dias para manter a performance';
COMMENT ON INDEX idx_activity_log_created_at IS 'Índice para ordenação por data de criação';
COMMENT ON INDEX idx_activity_log_user_id IS 'Índice para consultas filtradas por usuário';
COMMENT ON INDEX idx_profiles_last_login IS 'Índice para ordenação de usuários por último acesso';
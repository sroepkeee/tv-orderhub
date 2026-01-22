-- Habilitar extensão pg_cron para agendamento de tarefas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Habilitar extensão pg_net para requisições HTTP assíncronas
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Conceder permissões para o schema cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Comentário para documentação
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - usado para agendar tarefas automáticas como relatórios e processamento de fila';
COMMENT ON EXTENSION pg_net IS 'Async HTTP client - usado para invocar Edge Functions de forma assíncrona';
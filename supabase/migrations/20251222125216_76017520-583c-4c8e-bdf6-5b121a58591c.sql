-- Função RPC para verificar status do cron job de relatórios
CREATE OR REPLACE FUNCTION public.get_cron_job_status(job_name_pattern text DEFAULT 'daily-management-report%')
RETURNS TABLE (
  job_id bigint,
  job_name text,
  schedule text,
  is_active boolean,
  last_run timestamptz,
  next_run timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se a extensão pg_cron está disponível
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Retornar resultado vazio indicando que pg_cron não está habilitado
    RETURN;
  END IF;
  
  -- Buscar jobs que correspondem ao padrão
  RETURN QUERY
  SELECT 
    j.jobid::bigint,
    j.jobname::text,
    j.schedule::text,
    j.active::boolean,
    (SELECT MAX(end_time) FROM cron.job_run_details WHERE jobid = j.jobid)::timestamptz as last_run,
    NULL::timestamptz as next_run
  FROM cron.job j
  WHERE j.jobname LIKE job_name_pattern;
END;
$$;

-- Conceder permissão para usuários autenticados verificarem o status
GRANT EXECUTE ON FUNCTION public.get_cron_job_status(text) TO authenticated;
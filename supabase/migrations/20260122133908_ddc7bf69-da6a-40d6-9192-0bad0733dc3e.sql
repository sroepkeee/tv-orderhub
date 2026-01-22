-- Function to get all cron jobs with their execution status
CREATE OR REPLACE FUNCTION public.get_all_cron_jobs()
RETURNS TABLE (
  job_id bigint,
  job_name text,
  schedule text,
  is_active boolean,
  last_run timestamptz,
  last_status text,
  run_count bigint,
  success_count bigint,
  fail_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if pg_cron extension exists
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    j.jobid::bigint,
    j.jobname::text,
    j.schedule::text,
    j.active::boolean,
    (SELECT MAX(end_time) FROM cron.job_run_details WHERE jobid = j.jobid)::timestamptz,
    (SELECT status FROM cron.job_run_details WHERE jobid = j.jobid ORDER BY end_time DESC LIMIT 1)::text,
    (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = j.jobid)::bigint,
    (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = j.jobid AND status = 'succeeded')::bigint,
    (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = j.jobid AND status = 'failed')::bigint
  FROM cron.job j
  ORDER BY j.jobname;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_all_cron_jobs() TO authenticated;
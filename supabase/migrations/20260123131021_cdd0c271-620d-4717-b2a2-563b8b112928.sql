-- Add send_to_discord column to report_schedules
ALTER TABLE report_schedules 
ADD COLUMN IF NOT EXISTS send_to_discord BOOLEAN DEFAULT false;

COMMENT ON COLUMN report_schedules.send_to_discord IS 
  'Se true, envia relatório visual para Discord junto com WhatsApp';
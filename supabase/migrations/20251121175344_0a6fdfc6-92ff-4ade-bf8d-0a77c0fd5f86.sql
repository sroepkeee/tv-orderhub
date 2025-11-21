-- Adicionar 'completion' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'completion';

-- Comentário explicativo
COMMENT ON TYPE public.app_role IS 'Roles do sistema: admin, almox_ssm, order_generation, almox_general, production, balance_generation, laboratory, packaging, freight_quote, invoicing, logistics, completion';
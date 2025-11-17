-- PARTE 1: Adicionar novos valores ao enum app_role
-- Estes valores precisam ser committed antes de serem usados

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'order_generation';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'almox_general';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'production';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'balance_generation';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'laboratory';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'packaging';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'freight_quote';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'invoicing';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'logistics';
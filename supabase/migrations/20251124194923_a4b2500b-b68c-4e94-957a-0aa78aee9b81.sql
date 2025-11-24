-- Adicionar ready_to_invoice ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ready_to_invoice';
-- Adicionar role carriers_chat ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'carriers_chat';
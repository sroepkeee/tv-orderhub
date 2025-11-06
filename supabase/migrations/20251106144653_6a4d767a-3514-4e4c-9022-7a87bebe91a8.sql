-- Adicionar 3 novas roles ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'almox_filial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'almox_m16';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'laboratorio_filial';
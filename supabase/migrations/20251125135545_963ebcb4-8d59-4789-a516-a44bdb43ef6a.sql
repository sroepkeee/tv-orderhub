-- Migration 1: Adicionar role 'purchases' ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'purchases';
-- Migration: Fix Phase Permissions
-- This migration corrects the phase_permissions table to ensure each role
-- only has access to its corresponding phase(s)

-- Step 1: Clear all existing permissions except admin
DELETE FROM phase_permissions 
WHERE role != 'admin';

-- Step 2: Insert correct permissions for each role
-- Each role gets view + edit access to its corresponding phase

-- Almox SSM
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('almox_ssm', 'almox_ssm', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Order Generation
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('order_generation', 'order_generation', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Almox General
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('almox_general', 'almox_general', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Production
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('production', 'production', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Balance Generation
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('balance_generation', 'balance_generation', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Laboratory
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('laboratory', 'laboratory', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Packaging
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('packaging', 'packaging', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Freight Quote
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('freight_quote', 'freight_quote', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Invoicing
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('invoicing', 'invoicing', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Logistics
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('logistics', 'logistics', true, true, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = false;

-- Step 3: Add read-only access to previous phases for context
-- This allows users to see orders in earlier phases but not edit them

-- Order Generation can view Almox SSM
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('order_generation', 'almox_ssm', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Almox General can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('almox_general', 'almox_ssm', true, false, false),
  ('almox_general', 'order_generation', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Production can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('production', 'almox_ssm', true, false, false),
  ('production', 'order_generation', true, false, false),
  ('production', 'almox_general', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Balance Generation can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('balance_generation', 'almox_ssm', true, false, false),
  ('balance_generation', 'order_generation', true, false, false),
  ('balance_generation', 'almox_general', true, false, false),
  ('balance_generation', 'production', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Laboratory can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('laboratory', 'almox_ssm', true, false, false),
  ('laboratory', 'order_generation', true, false, false),
  ('laboratory', 'almox_general', true, false, false),
  ('laboratory', 'production', true, false, false),
  ('laboratory', 'balance_generation', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Packaging can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('packaging', 'almox_ssm', true, false, false),
  ('packaging', 'order_generation', true, false, false),
  ('packaging', 'almox_general', true, false, false),
  ('packaging', 'production', true, false, false),
  ('packaging', 'balance_generation', true, false, false),
  ('packaging', 'laboratory', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Freight Quote can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('freight_quote', 'almox_ssm', true, false, false),
  ('freight_quote', 'order_generation', true, false, false),
  ('freight_quote', 'almox_general', true, false, false),
  ('freight_quote', 'production', true, false, false),
  ('freight_quote', 'balance_generation', true, false, false),
  ('freight_quote', 'laboratory', true, false, false),
  ('freight_quote', 'packaging', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Invoicing can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('invoicing', 'almox_ssm', true, false, false),
  ('invoicing', 'order_generation', true, false, false),
  ('invoicing', 'almox_general', true, false, false),
  ('invoicing', 'production', true, false, false),
  ('invoicing', 'balance_generation', true, false, false),
  ('invoicing', 'laboratory', true, false, false),
  ('invoicing', 'packaging', true, false, false),
  ('invoicing', 'freight_quote', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Logistics can view previous phases
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES 
  ('logistics', 'almox_ssm', true, false, false),
  ('logistics', 'order_generation', true, false, false),
  ('logistics', 'almox_general', true, false, false),
  ('logistics', 'production', true, false, false),
  ('logistics', 'balance_generation', true, false, false),
  ('logistics', 'laboratory', true, false, false),
  ('logistics', 'packaging', true, false, false),
  ('logistics', 'freight_quote', true, false, false),
  ('logistics', 'invoicing', true, false, false)
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = false, can_delete = false;

-- Admin keeps full access (already exists, but ensure it's correct)
-- Admin should have access to all phases with full permissions
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
SELECT 
  'admin'::app_role,
  phase_key,
  true,
  true,
  true
FROM phase_config
ON CONFLICT (role, phase_key) DO UPDATE 
SET can_view = true, can_edit = true, can_delete = true;
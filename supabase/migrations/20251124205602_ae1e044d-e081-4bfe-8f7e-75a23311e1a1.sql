-- Add in_transit to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'in_transit';
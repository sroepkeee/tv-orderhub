-- Step 1: Add new roles to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'production_client';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'production_stock';
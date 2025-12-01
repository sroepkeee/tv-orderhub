-- Adicionar campos de liberação de produção na tabela orders
ALTER TABLE orders 
ADD COLUMN production_released BOOLEAN DEFAULT false,
ADD COLUMN production_released_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN production_released_by UUID REFERENCES auth.users(id);
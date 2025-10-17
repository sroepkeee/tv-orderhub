-- Fase 1: Reestruturação de Tipos de Pedido

-- 1. Adicionar novos campos à tabela order_type_config
ALTER TABLE public.order_type_config 
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros',
ADD COLUMN IF NOT EXISTS cost_center text,
ADD COLUMN IF NOT EXISTS responsible_department text,
ADD COLUMN IF NOT EXISTS icon text,
ADD COLUMN IF NOT EXISTS description text;

-- 2. Limpar dados antigos e inserir nova configuração
DELETE FROM public.order_type_config;

-- 3. Inserir novos tipos padronizados com todas as configurações
INSERT INTO public.order_type_config (
  order_type, 
  display_name, 
  category,
  default_status, 
  default_warehouse, 
  default_sla_days, 
  stock_operation, 
  operation_nature, 
  approval_required,
  cost_center,
  responsible_department,
  icon,
  description
) VALUES
  (
    'reposicao_estoque', 
    'Reposição de Estoque',
    'reposicao',
    'separacao', 
    'MATRIZ', 
    7, 
    'entry', 
    'Entrada por Reposição', 
    false,
    'PROD-001',
    'Produção',
    '📦',
    'Produção interna para repor o estoque central'
  ),
  (
    'reposicao_ecommerce', 
    'Reposição E-commerce',
    'reposicao',
    'producao', 
    'ECOMMERCE', 
    5, 
    'entry', 
    'Entrada E-commerce', 
    false,
    'ECOM-001',
    'E-commerce',
    '🛒',
    'Produção ou separação destinada ao estoque específico de e-commerce'
  ),
  (
    'vendas_balcao', 
    'Vendas Balcão',
    'vendas',
    'expedicao', 
    'MATRIZ', 
    2, 
    'exit', 
    'Saída por Venda', 
    true,
    'VEND-001',
    'Comercial',
    '🏪',
    'Pedidos diretos do cliente via balcão ou comercial interno'
  ),
  (
    'vendas_ecommerce', 
    'Vendas E-commerce',
    'vendas',
    'embalagem', 
    'ECOMMERCE', 
    3, 
    'exit', 
    'Saída E-commerce', 
    false,
    'ECOM-002',
    'E-commerce',
    '📱',
    'Pedidos vindos de lojas virtuais (Shopee, Mercado Livre, site próprio)'
  ),
  (
    'transferencia_filial', 
    'Transferência de Filiais',
    'operacoes_especiais',
    'embalagem', 
    null, 
    5, 
    'transfer', 
    'Transferência entre Unidades', 
    true,
    'LOG-001',
    'Logística',
    '🔄',
    'Envio de produtos entre filiais'
  ),
  (
    'remessa_conserto', 
    'Remessa para Conserto',
    'operacoes_especiais',
    'em_transito', 
    'RMA', 
    15, 
    'temporary_exit', 
    'Remessa Temporária - Conserto', 
    true,
    'MAN-001',
    'Manutenção',
    '🔧',
    'Envio de equipamentos para reparo (interno ou externo)'
  );

-- 4. Migrar pedidos existentes para novos tipos (mapeamento)
UPDATE public.orders 
SET order_type = CASE 
  WHEN order_type = 'reposicao' THEN 'reposicao_estoque'
  WHEN order_type = 'vendas' THEN 'vendas_balcao'
  WHEN order_type = 'transferencia' THEN 'transferencia_filial'
  WHEN order_type = 'remessa_conserto' THEN 'remessa_conserto'
  WHEN order_type = 'ecommerce' THEN 'vendas_ecommerce'
  ELSE order_type
END
WHERE order_type IN ('reposicao', 'vendas', 'transferencia', 'remessa_conserto', 'ecommerce');

-- 5. Adicionar coluna category na tabela orders para facilitar filtros
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_category text;

-- 6. Atualizar category nos pedidos existentes baseado no tipo
UPDATE public.orders o
SET order_category = (
  SELECT category 
  FROM public.order_type_config c 
  WHERE c.order_type = o.order_type
);

-- 7. Criar função para atualizar category automaticamente
CREATE OR REPLACE FUNCTION public.update_order_category()
RETURNS TRIGGER AS $$
BEGIN
  SELECT category INTO NEW.order_category
  FROM public.order_type_config
  WHERE order_type = NEW.order_type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Criar trigger para atualizar category automaticamente
DROP TRIGGER IF EXISTS trigger_update_order_category ON public.orders;
CREATE TRIGGER trigger_update_order_category
  BEFORE INSERT OR UPDATE OF order_type ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_category();

-- 9. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_order_category ON public.orders(order_category);
CREATE INDEX IF NOT EXISTS idx_order_type_config_category ON public.order_type_config(category);
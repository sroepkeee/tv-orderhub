-- Adicionar campos para rastreamento de firmware e imagem específica nas placas
ALTER TABLE public.orders 
ADD COLUMN requires_firmware boolean DEFAULT false,
ADD COLUMN firmware_project_name text,
ADD COLUMN requires_image boolean DEFAULT false,
ADD COLUMN image_project_name text;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.orders.requires_firmware IS 'Indica se o pedido requer instalação de firmware específico nas placas';
COMMENT ON COLUMN public.orders.firmware_project_name IS 'Nome do projeto ou versão do firmware a ser instalado';
COMMENT ON COLUMN public.orders.requires_image IS 'Indica se o pedido requer instalação de imagem específica';
COMMENT ON COLUMN public.orders.image_project_name IS 'Nome da imagem a ser instalada nas placas';
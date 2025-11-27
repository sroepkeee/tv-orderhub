-- Adicionar mapeamentos de departamento faltantes
INSERT INTO public.department_role_mapping (department, default_role) VALUES
('Compras', 'purchases'),
('Expedição', 'logistics'),
('Financeiro', 'invoicing'),
('TI', 'admin'),
('Projetos', 'order_generation'),
('SSM', 'almox_ssm'),
('Outros', 'production')
ON CONFLICT (department) DO NOTHING;
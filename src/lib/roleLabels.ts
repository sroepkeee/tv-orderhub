export const ROLE_LABELS: Record<string, { name: string; area: string }> = {
  // Admin permanece como role especial
  'admin': { name: 'Administrador', area: 'Administrativo' },
  
  // Fases do sistema (sincronizadas com phase_config)
  'almox_ssm': { name: 'Almox SSM', area: 'Almoxarifado' },
  'order_generation': { name: 'Gerar Ordem', area: 'Planejamento' },
  'purchases': { name: 'Compras', area: 'Suprimentos' },
  'almox_general': { name: 'Almox Geral', area: 'Almoxarifado' },
  'production_client': { name: 'Clientes', area: 'Produção' },
  'production_stock': { name: 'Estoque', area: 'Produção' },
  'balance_generation': { name: 'Gerar Saldo', area: 'Financeiro' },
  'laboratory': { name: 'Laboratório', area: 'Laboratório' },
  'packaging': { name: 'Embalagem', area: 'Expedição' },
  'freight_quote': { name: 'Cotação de Frete', area: 'Comercial' },
  'ready_to_invoice': { name: 'À Faturar', area: 'Financeiro' },
  'invoicing': { name: 'Solicitado Faturamento', area: 'Financeiro' },
  'logistics': { name: 'Expedição', area: 'Expedição' },
  'in_transit': { name: 'Em Trânsito', area: 'Expedição' },
  'completion': { name: 'Conclusão', area: 'Finalização' },
  'carriers_chat': { name: 'Chat Transportadoras', area: 'Comunicação' }
};

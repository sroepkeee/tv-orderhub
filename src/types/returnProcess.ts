// ============================================
// TIPOS DO MÓDULO DE DEVOLUÇÃO DE TÉCNICOS
// ============================================

export type ReturnProcessMotivo = 'desligamento' | 'troca' | 'ferias' | 'transferencia' | 'outro';

export type ReturnProcessStatus = 
  | 'aberto' 
  | 'em_checklist' 
  | 'aguardando_envio' 
  | 'enviado' 
  | 'em_transito' 
  | 'recebido' 
  | 'em_conferencia' 
  | 'divergencia' 
  | 'finalizado' 
  | 'cancelado';

export type ChecklistCategory = 
  | 'itens_fisicos' 
  | 'administrativo' 
  | 'acessos' 
  | 'documentos' 
  | 'financeiro';

export type ChecklistItemStatus = 'pendente' | 'concluido' | 'nao_aplicavel' | 'divergente';

export type ItemCondition = 'bom' | 'danificado' | 'faltante' | 'nao_verificado';

export type DivergenciaTipo = 'faltante' | 'danificado' | 'incorreto' | 'quantidade_incorreta';

export type DivergenciaStatus = 
  | 'identificada' 
  | 'notificada_gpi' 
  | 'em_analise' 
  | 'cobranca' 
  | 'resolvida' 
  | 'desconsiderada';

export type AccessType = 
  | 'email' 
  | 'paytrack' 
  | 'desk_manager' 
  | 'sistema_interno' 
  | 'integracao_externa' 
  | 'outro';

export type AccessBlockStatus = 'pendente' | 'bloqueado' | 'erro' | 'nao_aplicavel';

export type ShippingCarrierType = 'correios' | 'transportadora' | 'entrega_pessoal' | 'outro';

export type ShippingDestinationType = 'sede' | 'filial' | 'tecnico_receptor' | 'outro';

export type ShippingStatus = 
  | 'pendente' 
  | 'etiqueta_gerada' 
  | 'postado' 
  | 'em_transito' 
  | 'entregue' 
  | 'confirmado' 
  | 'problema';

export type TermType = 'equipamento' | 'veiculo' | 'ferramental' | 'epi' | 'uniforme' | 'outros';

export type TermStatus = 'ativo' | 'encerrado' | 'pendente_assinatura';

// ============================================
// INTERFACES
// ============================================

export interface ReturnProcess {
  id: string;
  organization_id: string | null;
  technician_id: string;
  motivo: ReturnProcessMotivo;
  motivo_detalhes: string | null;
  status: ReturnProcessStatus;
  opened_by: string | null;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  technician?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    specialty: string | null;
  };
  opened_by_profile?: {
    id: string;
    full_name: string | null;
  };
}

export interface ChecklistTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  target_role: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: ChecklistTemplateItem[];
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  name: string;
  category: ChecklistCategory;
  description: string | null;
  is_required: boolean;
  requires_photo: boolean;
  requires_video: boolean;
  requires_signature: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProcessChecklistItem {
  id: string;
  process_id: string;
  template_item_id: string | null;
  item_name: string;
  category: ChecklistCategory;
  status: ChecklistItemStatus;
  condition: ItemCondition | null;
  evidence_urls: string[] | null;
  signature_url: string | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Divergencia {
  id: string;
  organization_id: string | null;
  process_id: string;
  checklist_item_id: string | null;
  item_name: string;
  tipo: DivergenciaTipo;
  description: string | null;
  expected_value: string | null;
  actual_value: string | null;
  estimated_cost: number | null;
  evidence_urls: string[] | null;
  status: DivergenciaStatus;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessBlock {
  id: string;
  organization_id: string | null;
  process_id: string;
  technician_id: string;
  access_type: AccessType;
  access_name: string | null;
  status: AccessBlockStatus;
  blocked_by: string | null;
  blocked_at: string | null;
  evidence_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnAuditLog {
  id: string;
  organization_id: string | null;
  process_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ProcessShipping {
  id: string;
  organization_id: string | null;
  process_id: string;
  carrier_type: ShippingCarrierType | null;
  carrier_name: string | null;
  tracking_code: string | null;
  label_url: string | null;
  origin_address: Record<string, unknown> | null;
  destination_address: Record<string, unknown> | null;
  destination_type: ShippingDestinationType | null;
  receiver_technician_id: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_confirmed_by: string | null;
  status: ShippingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResponsibilityTerm {
  id: string;
  organization_id: string | null;
  technician_id: string;
  term_type: TermType;
  title: string;
  description: string | null;
  document_url: string | null;
  signed_at: string | null;
  signature_url: string | null;
  items: Record<string, unknown> | null;
  valid_until: string | null;
  status: TermStatus;
  created_at: string;
  updated_at: string;
}

// ============================================
// LABELS E CORES
// ============================================

export const MOTIVO_LABELS: Record<ReturnProcessMotivo, string> = {
  desligamento: 'Desligamento',
  troca: 'Troca de Equipamento',
  ferias: 'Férias',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export const STATUS_LABELS: Record<ReturnProcessStatus, string> = {
  aberto: 'Aberto',
  em_checklist: 'Em Checklist',
  aguardando_envio: 'Aguardando Envio',
  enviado: 'Enviado',
  em_transito: 'Em Trânsito',
  recebido: 'Recebido',
  em_conferencia: 'Em Conferência',
  divergencia: 'Divergência',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const STATUS_COLORS: Record<ReturnProcessStatus, string> = {
  aberto: 'bg-blue-100 text-blue-800',
  em_checklist: 'bg-amber-100 text-amber-800',
  aguardando_envio: 'bg-orange-100 text-orange-800',
  enviado: 'bg-purple-100 text-purple-800',
  em_transito: 'bg-indigo-100 text-indigo-800',
  recebido: 'bg-teal-100 text-teal-800',
  em_conferencia: 'bg-cyan-100 text-cyan-800',
  divergencia: 'bg-red-100 text-red-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  itens_fisicos: 'Itens Físicos',
  administrativo: 'Administrativo',
  acessos: 'Acessos',
  documentos: 'Documentos',
  financeiro: 'Financeiro',
};

export const CATEGORY_ICONS: Record<ChecklistCategory, string> = {
  itens_fisicos: 'Package',
  administrativo: 'FileText',
  acessos: 'Key',
  documentos: 'Folder',
  financeiro: 'DollarSign',
};

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  bom: 'Bom Estado',
  danificado: 'Danificado',
  faltante: 'Faltante',
  nao_verificado: 'Não Verificado',
};

export const CONDITION_COLORS: Record<ItemCondition, string> = {
  bom: 'bg-emerald-100 text-emerald-800',
  danificado: 'bg-red-100 text-red-800',
  faltante: 'bg-orange-100 text-orange-800',
  nao_verificado: 'bg-gray-100 text-gray-800',
};

export const DIVERGENCIA_TIPO_LABELS: Record<DivergenciaTipo, string> = {
  faltante: 'Item Faltante',
  danificado: 'Item Danificado',
  incorreto: 'Item Incorreto',
  quantidade_incorreta: 'Quantidade Incorreta',
};

export const DIVERGENCIA_STATUS_LABELS: Record<DivergenciaStatus, string> = {
  identificada: 'Identificada',
  notificada_gpi: 'Notificada GPI',
  em_analise: 'Em Análise',
  cobranca: 'Em Cobrança',
  resolvida: 'Resolvida',
  desconsiderada: 'Desconsiderada',
};

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  email: 'Email Corporativo',
  paytrack: 'Paytrack',
  desk_manager: 'Desk Manager',
  sistema_interno: 'Sistema Interno',
  integracao_externa: 'Integração Externa',
  outro: 'Outro',
};

export const ACCESS_BLOCK_STATUS_LABELS: Record<AccessBlockStatus, string> = {
  pendente: 'Pendente',
  bloqueado: 'Bloqueado',
  erro: 'Erro ao Bloquear',
  nao_aplicavel: 'Não Aplicável',
};

export const ACCESS_BLOCK_STATUS_COLORS: Record<AccessBlockStatus, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  bloqueado: 'bg-emerald-100 text-emerald-800',
  erro: 'bg-red-100 text-red-800',
  nao_aplicavel: 'bg-gray-100 text-gray-800',
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  pendente: 'Pendente',
  etiqueta_gerada: 'Etiqueta Gerada',
  postado: 'Postado',
  em_transito: 'Em Trânsito',
  entregue: 'Entregue',
  confirmado: 'Confirmado',
  problema: 'Problema',
};

// Mapeamento de fases/status que podem disparar notificações ao cliente
export const NOTIFICATION_PHASE_OPTIONS = [
  {
    value: 'order_created',
    label: 'Pedido Criado',
    description: 'Quando um novo pedido é registrado no sistema',
    status: ['almox_ssm_pending', 'almox_ssm_received'] as string[],
  },
  {
    value: 'in_production',
    label: 'Em Produção',
    description: 'Quando o pedido entra na fase de produção',
    status: ['separation_started', 'in_production'] as string[],
  },
  {
    value: 'production_completed',
    label: 'Produção Concluída',
    description: 'Quando a produção do pedido é finalizada',
    status: ['production_completed', 'separation_completed'] as string[],
  },
  {
    value: 'ready_for_shipping',
    label: 'Pronto para Envio',
    description: 'Quando o pedido está pronto para ser despachado',
    status: ['ready_for_shipping', 'awaiting_pickup', 'pickup_scheduled'] as string[],
  },
  {
    value: 'in_transit',
    label: 'Em Trânsito',
    description: 'Quando o pedido saiu para entrega',
    status: ['in_transit', 'collected'] as string[],
  },
  {
    value: 'delivered',
    label: 'Entregue',
    description: 'Quando o pedido foi entregue ao cliente',
    status: ['delivered', 'completed'] as string[],
  },
  {
    value: 'delayed',
    label: 'Atrasado',
    description: 'Quando o pedido está com atraso na entrega',
    status: ['delayed'] as string[],
  },
  {
    value: 'ready_to_invoice',
    label: 'À Faturar',
    description: 'Quando o pedido está pronto para faturamento',
    status: ['ready_to_invoice', 'pending_invoice_request'] as string[],
  },
  {
    value: 'invoicing',
    label: 'Faturamento Solicitado',
    description: 'Quando o faturamento do pedido foi solicitado',
    status: ['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'] as string[],
  },
];

// Função para verificar se um status deve disparar notificação
export function shouldNotifyForStatus(
  currentStatus: string,
  enabledPhases: string[]
): { shouldNotify: boolean; phase: string | null } {
  for (const phase of NOTIFICATION_PHASE_OPTIONS) {
    if (phase.status.includes(currentStatus) && enabledPhases.includes(phase.value)) {
      return { shouldNotify: true, phase: phase.value };
    }
  }
  return { shouldNotify: false, phase: null };
}

// Função para obter o label de uma fase
export function getPhaseLabel(phaseValue: string): string {
  const phase = NOTIFICATION_PHASE_OPTIONS.find(p => p.value === phaseValue);
  return phase?.label || phaseValue;
}

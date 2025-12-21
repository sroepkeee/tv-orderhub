import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PhaseData {
  phase: string;
  startDate: string;
  endDate: string | null;
  daysInPhase: number;
}

interface OrderPhaseTimelineProps {
  orderId: string;
  currentStatus: string;
}

const phaseLabels: Record<string, string> = {
  'almox_ssm_received': 'Recebido SSM',
  'almox_ssm_in_review': 'Análise SSM',
  'almox_ssm_approved': 'Aprovado SSM',
  'order_generation_pending': 'Pendente Ordem',
  'order_in_creation': 'Criando Ordem',
  'order_generated': 'Ordem Gerada',
  'almox_general_received': 'Recebido Almox',
  'almox_general_separating': 'Separando',
  'almox_general_ready': 'Pronto Almox',
  'separation_started': 'Separação Iniciada',
  'in_production': 'Em Produção',
  'awaiting_material': 'Aguard. Material',
  'separation_completed': 'Separação Concluída',
  'production_completed': 'Produção Concluída',
  'balance_calculation': 'Calc. Saldo',
  'balance_review': 'Revisando Saldo',
  'balance_approved': 'Saldo Aprovado',
  'awaiting_lab': 'Aguard. Lab',
  'in_lab_analysis': 'Análise Lab',
  'lab_completed': 'Lab Concluído',
  'in_quality_check': 'Em Conferência',
  'in_packaging': 'Em Embalagem',
  'ready_for_shipping': 'Pronto p/ Envio',
  'freight_quote_requested': 'Cotação Solicitada',
  'freight_quote_received': 'Cotação Recebida',
  'freight_approved': 'Frete Aprovado',
  'ready_to_invoice': 'Pronto p/ Faturar',
  'pending_invoice_request': 'Aguard. Solic.',
  'invoice_requested': 'Solic. Faturamento',
  'awaiting_invoice': 'Proces. Faturamento',
  'invoice_issued': 'NF Emitida',
  'invoice_sent': 'NF Enviada',
  'released_for_shipping': 'Liberado p/ Envio',
  'in_expedition': 'Na Expedição',
  'in_transit': 'Em Trânsito',
  'pickup_scheduled': 'Retirada Agendada',
  'awaiting_pickup': 'Aguard. Retirada',
  'collected': 'Coletado',
  'delivered': 'Entregue',
  'completed': 'Concluído',
  'pending': 'Pendente',
  'in_analysis': 'Em Análise',
  'awaiting_approval': 'Aguard. Aprovação',
  'planned': 'Planejado'
};

export function OrderPhaseTimeline({ orderId, currentStatus }: OrderPhaseTimelineProps) {
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhaseHistory();
  }, [orderId]);

  const loadPhaseHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: true });

      if (error) throw error;

      // Processar histórico para calcular tempo em cada fase
      const phaseMap = new Map<string, PhaseData>();
      
      if (data && data.length > 0) {
        data.forEach((history, index) => {
          const phase = history.new_status;
          const startDate = history.changed_at;
          const endDate = index < data.length - 1 ? data[index + 1].changed_at : null;
          
          // Usar Math.floor para evitar arredondamento excessivo (+1 dia extra)
          // Fases concluídas: mínimo 1 dia, fase atual: mínimo 0 dias
          const diffMs = endDate 
            ? new Date(endDate).getTime() - new Date(startDate).getTime()
            : new Date().getTime() - new Date(startDate).getTime();
          const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const daysInPhase = endDate ? Math.max(1, rawDays) : Math.max(0, rawDays);

          phaseMap.set(phase, {
            phase,
            startDate,
            endDate,
            daysInPhase
          });
        });
      } else {
        // Se não há histórico, usar status atual
        phaseMap.set(currentStatus, {
          phase: currentStatus,
          startDate: new Date().toISOString(),
          endDate: null,
          daysInPhase: 0
        });
      }

      setPhases(Array.from(phaseMap.values()));
    } catch (error) {
      console.error('Error loading phase history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const totalDays = phases.reduce((sum, phase) => sum + phase.daysInPhase, 0);

  return (
    <div className="space-y-4">
      {/* Barra de Timeline */}
      <div className="relative">
        <div className="flex gap-1 h-8">
          {phases.map((phase, index) => {
            const widthPercent = totalDays > 0 ? (phase.daysInPhase / totalDays) * 100 : 100 / phases.length;
            const isActive = phase.phase === currentStatus;
            
            return (
              <div
                key={phase.phase}
                className={`relative flex items-center justify-center rounded transition-all ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : index < phases.findIndex(p => p.phase === currentStatus)
                    ? 'bg-primary/60'
                    : 'bg-muted'
                }`}
                style={{ width: `${widthPercent}%`, minWidth: '60px' }}
              >
                <span className="text-xs font-medium truncate px-1">
                  {phase.daysInPhase}d
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {phases.map((phase) => (
          <div key={phase.phase} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${
              phase.phase === currentStatus 
                ? 'bg-primary' 
                : 'bg-muted'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {phaseLabels[phase.phase] || phase.phase}
              </p>
              <p className="text-xs text-muted-foreground">
                {phase.daysInPhase} {phase.daysInPhase === 1 ? 'dia' : 'dias'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tempo Total */}
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tempo Total</span>
          <Badge variant="outline">{totalDays} dias</Badge>
        </div>
      </div>
    </div>
  );
}

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
  'pending': 'Pendente',
  'approved': 'Aprovado',
  'separating': 'Separação',
  'separated': 'Separado',
  'in_production': 'Produção',
  'produced': 'Produzido',
  'shipped': 'Expedido',
  'delivered': 'Entregue',
  'completed': 'Concluído'
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
          
          const daysInPhase = endDate 
            ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

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

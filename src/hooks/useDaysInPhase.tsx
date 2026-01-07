import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

interface PhaseEntry {
  orderId: string;
  daysInPhase: number;
  phaseEnteredAt: Date | null;
}

interface UseDaysInPhaseResult {
  getDaysInPhase: (orderId: string) => number | null;
  getPhaseEnteredAt: (orderId: string) => Date | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Hook para calcular quantos dias cada pedido está na fase atual.
 * Busca no order_history a última entrada de status do pedido.
 */
export const useDaysInPhase = (orderIds: string[]): UseDaysInPhaseResult => {
  const [phaseData, setPhaseData] = useState<Map<string, PhaseEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchPhaseEntryDates = useCallback(async () => {
    if (orderIds.length === 0) return;
    
    setLoading(true);
    try {
      // Buscar o histórico de cada pedido - última mudança para o status atual
      const { data: historyData, error } = await supabase
        .from('order_history')
        .select('order_id, new_status, changed_at')
        .in('order_id', orderIds)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        return;
      }

      // Para cada pedido, pegar a data da última transição de status
      const phaseMap = new Map<string, PhaseEntry>();
      const latestByOrder = new Map<string, { changed_at: string }>();

      historyData?.forEach(entry => {
        // Apenas a primeira entrada (mais recente) de cada pedido
        if (!latestByOrder.has(entry.order_id)) {
          latestByOrder.set(entry.order_id, { changed_at: entry.changed_at });
        }
      });

      // Calcular dias na fase para cada pedido
      latestByOrder.forEach((entry, orderId) => {
        const enteredAt = new Date(entry.changed_at);
        const today = new Date();
        const daysInPhase = differenceInDays(today, enteredAt);
        
        phaseMap.set(orderId, {
          orderId,
          daysInPhase: Math.max(0, daysInPhase),
          phaseEnteredAt: enteredAt
        });
      });

      // Pedidos sem histórico = entraram hoje ou não têm registro
      orderIds.forEach(id => {
        if (!phaseMap.has(id)) {
          phaseMap.set(id, {
            orderId: id,
            daysInPhase: 0,
            phaseEnteredAt: null
          });
        }
      });

      setPhaseData(phaseMap);
    } catch (error) {
      console.error('Erro ao calcular dias na fase:', error);
    } finally {
      setLoading(false);
    }
  }, [orderIds.join(',')]); // Dependência no conjunto de IDs

  useEffect(() => {
    fetchPhaseEntryDates();
  }, [fetchPhaseEntryDates]);

  const getDaysInPhase = useCallback((orderId: string): number | null => {
    const entry = phaseData.get(orderId);
    return entry ? entry.daysInPhase : null;
  }, [phaseData]);

  const getPhaseEnteredAt = useCallback((orderId: string): Date | null => {
    const entry = phaseData.get(orderId);
    return entry ? entry.phaseEnteredAt : null;
  }, [phaseData]);

  return {
    getDaysInPhase,
    getPhaseEnteredAt,
    loading,
    refresh: fetchPhaseEntryDates
  };
};

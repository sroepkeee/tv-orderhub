import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
 * Se não houver histórico, usa created_at do pedido como fallback.
 */
export const useDaysInPhase = (orderIds: string[]): UseDaysInPhaseResult => {
  const [phaseData, setPhaseData] = useState<Map<string, PhaseEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchPhaseEntryDates = useCallback(async () => {
    if (orderIds.length === 0) return;
    
    setLoading(true);
    try {
      // 1. Buscar dados dos pedidos (status atual e data de criação)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, created_at')
        .in('id', orderIds);

      if (ordersError) {
        console.error('Erro ao buscar pedidos:', ordersError);
        return;
      }

      // 2. Buscar histórico de mudanças de status
      const { data: historyData, error: historyError } = await supabase
        .from('order_history')
        .select('order_id, new_status, changed_at')
        .in('order_id', orderIds)
        .order('changed_at', { ascending: false });

      if (historyError) {
        console.error('Erro ao buscar histórico:', historyError);
        return;
      }

      // 3. Criar mapas de status atual e created_at
      const currentStatusMap = new Map<string, string>();
      const createdAtMap = new Map<string, string>();
      
      ordersData?.forEach(order => {
        if (order.status) currentStatusMap.set(order.id, order.status);
        if (order.created_at) createdAtMap.set(order.id, order.created_at);
      });

      // 4. Para cada pedido, encontrar a entrada mais recente para o STATUS ATUAL
      const latestByOrder = new Map<string, { changed_at: string }>();

      historyData?.forEach(entry => {
        const currentStatus = currentStatusMap.get(entry.order_id);
        
        // Só considera se new_status = status atual do pedido
        // E se ainda não temos uma entrada para este pedido
        if (entry.new_status === currentStatus && !latestByOrder.has(entry.order_id)) {
          latestByOrder.set(entry.order_id, { changed_at: entry.changed_at });
        }
      });

      // 5. Para pedidos sem histórico válido, usar created_at como fallback
      orderIds.forEach(id => {
        if (!latestByOrder.has(id)) {
          const createdAt = createdAtMap.get(id);
          if (createdAt) {
            latestByOrder.set(id, { changed_at: createdAt });
          }
        }
      });

      // 6. Calcular dias na fase para cada pedido
      const phaseMap = new Map<string, PhaseEntry>();
      const today = new Date();

      latestByOrder.forEach((entry, orderId) => {
        const enteredAt = new Date(entry.changed_at);
        
        // Calcular diferença em milissegundos e converter para dias
        // Usar Math.ceil para que horas parciais contem como 1 dia
        const diffMs = today.getTime() - enteredAt.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        // Se for menos de 24h mas do dia anterior, conta como 1 dia
        // Se for no mesmo dia, conta como 0
        const daysInPhase = Math.max(0, Math.floor(diffDays));
        
        phaseMap.set(orderId, {
          orderId,
          daysInPhase,
          phaseEnteredAt: enteredAt
        });
      });

      // 7. Pedidos que não têm nem histórico nem created_at = 0 dias
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

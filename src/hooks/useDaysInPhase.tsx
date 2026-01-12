import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPhaseFromStatus } from '@/lib/kanbanPhase';

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

const CHUNK_SIZE = 50; // Processar em lotes para evitar limite de URL

/**
 * Hook para calcular quantos dias cada pedido está na FASE atual (não status).
 * - Zera quando muda de FASE
 * - NÃO zera quando muda de status dentro da mesma fase
 */
export const useDaysInPhase = (orderIds: string[]): UseDaysInPhaseResult => {
  const [phaseData, setPhaseData] = useState<Map<string, PhaseEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  // Dependência estável para evitar re-fetches desnecessários
  const orderIdsKey = useMemo(() => {
    const sorted = [...orderIds].sort();
    return JSON.stringify(sorted);
  }, [orderIds]);

  const fetchPhaseEntryDates = useCallback(async () => {
    if (orderIds.length === 0) {
      setPhaseData(new Map());
      return;
    }

    console.log('[useDaysInPhase] Iniciando busca para', orderIds.length, 'pedidos');
    
    setLoading(true);
    try {
      // Dividir em chunks para evitar limite de URL
      const chunks: string[][] = [];
      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        chunks.push(orderIds.slice(i, i + CHUNK_SIZE));
      }
      
      console.log('[useDaysInPhase] Dividido em', chunks.length, 'chunks de até', CHUNK_SIZE, 'IDs');

      // Buscar dados em paralelo por chunk
      const ordersPromises = chunks.map(chunk =>
        supabase
          .from('orders')
          .select('id, status, created_at, order_category')
          .in('id', chunk)
      );

      const historyPromises = chunks.map(chunk =>
        supabase
          .from('order_history')
          .select('order_id, old_status, new_status, changed_at')
          .in('order_id', chunk)
          .order('changed_at', { ascending: false })
      );

      const [ordersResults, historyResults] = await Promise.all([
        Promise.all(ordersPromises),
        Promise.all(historyPromises)
      ]);

      // Combinar resultados de todos os chunks
      const ordersData = ordersResults.flatMap(r => r.data || []);
      const historyData = historyResults.flatMap(r => r.data || []);

      // Verificar erros
      const ordersError = ordersResults.find(r => r.error);
      const historyError = historyResults.find(r => r.error);
      
      if (ordersError?.error) {
        console.error('[useDaysInPhase] Erro ao buscar pedidos:', ordersError.error);
      }
      if (historyError?.error) {
        console.error('[useDaysInPhase] Erro ao buscar histórico:', historyError.error);
      }

      console.log('[useDaysInPhase] Dados carregados:', ordersData.length, 'pedidos,', historyData.length, 'registros de histórico');

      // Criar mapas auxiliares
      const orderInfoMap = new Map<string, { status: string; createdAt: string; category: string }>();
      ordersData.forEach(order => {
        orderInfoMap.set(order.id, {
          status: order.status || '',
          createdAt: order.created_at || '',
          category: order.order_category || ''
        });
      });

      // Agrupar histórico por pedido
      const historyByOrder = new Map<string, Array<{ old_status: string | null; new_status: string; changed_at: string }>>();
      historyData.forEach(entry => {
        if (!historyByOrder.has(entry.order_id)) {
          historyByOrder.set(entry.order_id, []);
        }
        historyByOrder.get(entry.order_id)!.push({
          old_status: entry.old_status,
          new_status: entry.new_status,
          changed_at: entry.changed_at
        });
      });

      // Calcular entrada na fase para cada pedido
      const phaseMap = new Map<string, PhaseEntry>();
      const today = new Date();

      orderIds.forEach(orderId => {
        const orderInfo = orderInfoMap.get(orderId);
        if (!orderInfo) {
          // Pedido não encontrado
          phaseMap.set(orderId, { orderId, daysInPhase: 0, phaseEnteredAt: null });
          return;
        }

        const currentPhase = getPhaseFromStatus(orderInfo.status, orderInfo.category);
        const history = historyByOrder.get(orderId) || [];
        
        let phaseEnteredAt: Date | null = null;

        // Procurar no histórico a ÚLTIMA mudança que ENTROU na fase atual
        // (onde old_status tinha fase diferente e new_status tem a fase atual)
        for (const entry of history) {
          const newPhase = getPhaseFromStatus(entry.new_status, orderInfo.category);
          const oldPhase = entry.old_status 
            ? getPhaseFromStatus(entry.old_status, orderInfo.category) 
            : null;

          if (newPhase === currentPhase && oldPhase !== currentPhase) {
            // Encontrou a entrada na fase atual
            phaseEnteredAt = new Date(entry.changed_at);
            break;
          }
        }

        // Se não encontrou mudança de fase, verificar se há histórico na fase atual
        if (!phaseEnteredAt && history.length > 0) {
          // Pegar o registro mais ANTIGO que já está na fase atual
          const historyInCurrentPhase = history
            .filter(h => getPhaseFromStatus(h.new_status, orderInfo.category) === currentPhase)
            .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
          
          if (historyInCurrentPhase.length > 0) {
            phaseEnteredAt = new Date(historyInCurrentPhase[0].changed_at);
          }
        }

        // Fallback final: usar created_at do pedido
        if (!phaseEnteredAt && orderInfo.createdAt) {
          phaseEnteredAt = new Date(orderInfo.createdAt);
        }

        // Calcular dias na fase
        let daysInPhase = 0;
        if (phaseEnteredAt) {
          const diffMs = today.getTime() - phaseEnteredAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          // Se for menos de 1 dia, mostrar 0. Caso contrário, arredondar para cima.
          daysInPhase = diffDays < 1 ? 0 : Math.ceil(diffDays);
        }

        phaseMap.set(orderId, {
          orderId,
          daysInPhase: Math.max(0, daysInPhase),
          phaseEnteredAt
        });
      });

      console.log('[useDaysInPhase] Calculados', phaseMap.size, 'pedidos');
      
      // Log de amostra para debug
      const sample = Array.from(phaseMap.entries())
        .slice(0, 5)
        .map(([id, e]) => `${id.slice(0, 8)}...=${e.daysInPhase}d`);
      console.log('[useDaysInPhase] Amostra:', sample.join(', '));

      // Log de pedidos com mais dias
      const topDays = Array.from(phaseMap.entries())
        .sort((a, b) => b[1].daysInPhase - a[1].daysInPhase)
        .slice(0, 3)
        .map(([id, e]) => `${id.slice(0, 8)}...=${e.daysInPhase}d`);
      console.log('[useDaysInPhase] Maiores:', topDays.join(', '));

      setPhaseData(phaseMap);
    } catch (error) {
      console.error('[useDaysInPhase] Erro geral:', error);
    } finally {
      setLoading(false);
    }
  }, [orderIdsKey]);

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

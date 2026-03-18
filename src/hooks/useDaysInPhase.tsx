import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

const CHUNK_SIZE = 50;

const fetchPhaseEntryDates = async (orderIds: string[]): Promise<Record<string, PhaseEntry>> => {
  if (orderIds.length === 0) return {};

  // Dividir em chunks
  const chunks: string[][] = [];
  for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
    chunks.push(orderIds.slice(i, i + CHUNK_SIZE));
  }

  // 🚀 Buscar orders + history em paralelo
  const ordersPromises = chunks.map(chunk =>
    supabase.from('orders').select('id, status, created_at, order_category').in('id', chunk)
  );
  const historyPromises = chunks.map(chunk =>
    supabase.from('order_history')
      .select('order_id, old_status, new_status, changed_at')
      .in('order_id', chunk)
      .order('changed_at', { ascending: false })
  );

  let ordersResults: Awaited<ReturnType<typeof supabase.from<'orders'>>['select']>[];
  let historyResults: Awaited<ReturnType<typeof supabase.from<'order_history'>>['select']>[];

  try {
    [ordersResults, historyResults] = await Promise.all([
      Promise.all(ordersPromises),
      Promise.all(historyPromises)
    ]);
  } catch (err) {
    console.error('⏱️ [useDaysInPhase] Erro ao buscar dados:', err);
    // Fallback: retornar dados vazios para que o card mostre 0d em vez de "..."
    const result: Record<string, PhaseEntry> = {};
    orderIds.forEach(id => { result[id] = { orderId: id, daysInPhase: 0, phaseEnteredAt: null }; });
    return result;
  }

  const ordersData = ordersResults.flatMap(r => {
    if (r.error) console.warn('⏱️ [useDaysInPhase] Erro orders query:', r.error.message);
    return r.data || [];
  });
  const historyData = historyResults.flatMap(r => {
    if (r.error) console.warn('⏱️ [useDaysInPhase] Erro history query:', r.error.message);
    return r.data || [];
  });

  console.log(`⏱️ [useDaysInPhase] Carregou ${ordersData.length} orders, ${historyData.length} history entries`);

  // Criar mapas auxiliares
  const orderInfoMap = new Map<string, { status: string; createdAt: string; category: string }>();
  ordersData.forEach(order => {
    orderInfoMap.set(order.id, {
      status: order.status || '',
      createdAt: order.created_at || '',
      category: order.order_category || ''
    });
  });

  const historyByOrder = new Map<string, Array<{ old_status: string | null; new_status: string; changed_at: string }>>();
  historyData.forEach(entry => {
    if (!historyByOrder.has(entry.order_id)) historyByOrder.set(entry.order_id, []);
    historyByOrder.get(entry.order_id)!.push({
      old_status: entry.old_status,
      new_status: entry.new_status,
      changed_at: entry.changed_at
    });
  });

  const result: Record<string, PhaseEntry> = {};
  const today = new Date();

  orderIds.forEach(orderId => {
    const orderInfo = orderInfoMap.get(orderId);
    if (!orderInfo) {
      result[orderId] = { orderId, daysInPhase: 0, phaseEnteredAt: null };
      return;
    }

    const currentPhase = getPhaseFromStatus(orderInfo.status, orderInfo.category);
    const history = historyByOrder.get(orderId) || [];
    let phaseEnteredAt: Date | null = null;

    for (const entry of history) {
      const newPhase = getPhaseFromStatus(entry.new_status, orderInfo.category);
      const oldPhase = entry.old_status ? getPhaseFromStatus(entry.old_status, orderInfo.category) : null;
      if (newPhase === currentPhase && oldPhase !== currentPhase) {
        phaseEnteredAt = new Date(entry.changed_at);
        break;
      }
    }

    if (!phaseEnteredAt && history.length > 0) {
      const historyInCurrentPhase = history
        .filter(h => getPhaseFromStatus(h.new_status, orderInfo.category) === currentPhase)
        .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
      if (historyInCurrentPhase.length > 0) {
        phaseEnteredAt = new Date(historyInCurrentPhase[0].changed_at);
      }
    }

    if (!phaseEnteredAt && orderInfo.createdAt) {
      phaseEnteredAt = new Date(orderInfo.createdAt);
    }

    let daysInPhase = 0;
    if (phaseEnteredAt) {
      const diffMs = today.getTime() - phaseEnteredAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      daysInPhase = diffDays < 1 ? 0 : Math.ceil(diffDays);
    }

    result[orderId] = {
      orderId,
      daysInPhase: Math.max(0, daysInPhase),
      phaseEnteredAt
    };
  });

  return result;
};

export const useDaysInPhase = (orderIds: string[]): UseDaysInPhaseResult => {
  const orderIdsKey = useMemo(() => {
    const sorted = [...orderIds].sort();
    return JSON.stringify(sorted);
  }, [orderIds]);

  const { data: phaseData = {}, isLoading, refetch } = useQuery({
    queryKey: ['days-in-phase', orderIdsKey],
    queryFn: () => fetchPhaseEntryDates(orderIds),
    staleTime: 60_000,      // 1 min
    gcTime: 5 * 60_000,     // 5 min no cache
    enabled: orderIds.length > 0,
    refetchOnWindowFocus: false,
  });

  const getDaysInPhase = useCallback((orderId: string): number | null => {
    return phaseData[orderId]?.daysInPhase ?? null;
  }, [phaseData]);

  const getPhaseEnteredAt = useCallback((orderId: string): Date | null => {
    return phaseData[orderId]?.phaseEnteredAt ?? null;
  }, [phaseData]);

  return {
    getDaysInPhase,
    getPhaseEnteredAt,
    loading: isLoading,
    refresh: refetch
  };
};

import { differenceInDays, parseISO } from 'date-fns';
import type { Order } from '@/components/Dashboard';

/**
 * Calcula taxa de cumprimento real considerando pedidos ativos e seus prazos
 */
export const calculateRealOnTimeRate = (orders: Order[]): number => {
  const activeOrders = orders.filter(o => 
    !['delivered', 'completed', 'cancelled'].includes(o.status)
  );
  
  if (activeOrders.length === 0) return 100;
  
  const today = new Date();
  const onTimeOrders = activeOrders.filter(order => {
    const deadline = parseISO(order.deliveryDeadline);
    const daysUntil = differenceInDays(deadline, today);
    return daysUntil >= 0; // Ainda no prazo
  });
  
  return Math.round((onTimeOrders.length / activeOrders.length) * 100);
};

/**
 * Calcula estatísticas detalhadas de itens em produção
 */
export const calculateProductionStats = (orders: Order[]) => {
  const today = new Date();
  const productionOrders = orders.filter(o => 
    ['separation_started', 'in_production', 'awaiting_material'].includes(o.status)
  );
  
  const lateItems = productionOrders.filter(o => {
    const deadline = parseISO(o.deliveryDeadline);
    return differenceInDays(deadline, today) < 0;
  }).length;
  
  const onTimeItems = productionOrders.length - lateItems;
  
  // Calcular prazo médio
  const avgDays = productionOrders.length > 0
    ? Math.round(
        productionOrders.reduce((sum, o) => {
          // ✨ PRIORIZAR data de liberação de produção quando disponível
          const start = o.production_released_at 
            ? parseISO(o.production_released_at)
            : o.issueDate 
              ? parseISO(o.issueDate) 
              : parseISO(o.createdDate);
          return sum + differenceInDays(today, start);
        }, 0) / productionOrders.length
      )
    : 0;
  
  return {
    total: productionOrders.length,
    late: lateItems,
    onTime: onTimeItems,
    avgDays
  };
};

/**
 * Calcula estatísticas de itens críticos por intervalo de dias
 */
export const calculateCriticalItemsBreakdown = (orders: Order[]) => {
  const today = new Date();
  const activeOrders = orders.filter(o => 
    !['delivered', 'completed', 'cancelled'].includes(o.status)
  );
  
  let today_count = 0;
  let tomorrow_count = 0;
  let days_2_3_count = 0;
  
  activeOrders.forEach(order => {
    const deadline = parseISO(order.deliveryDeadline);
    const daysUntil = differenceInDays(deadline, today);
    
    if (daysUntil === 0) today_count++;
    else if (daysUntil === 1) tomorrow_count++;
    else if (daysUntil >= 2 && daysUntil <= 3) days_2_3_count++;
  });
  
  return {
    today: today_count,
    tomorrow: tomorrow_count,
    days2to3: days_2_3_count,
    total: today_count + tomorrow_count + days_2_3_count
  };
};

/**
 * Calcula estatísticas de itens pendentes
 */
export const calculatePendingStats = (orders: Order[]) => {
  const pendingOrders = orders.filter(o => 
    ['pending', 'in_analysis', 'awaiting_approval'].includes(o.status)
  );
  
  const today = new Date();
  const avgWaitTime = pendingOrders.length > 0
    ? Math.round(
        pendingOrders.reduce((sum, o) => {
          // ✨ PRIORIZAR data de liberação quando disponível
          const start = o.production_released_at 
            ? parseISO(o.production_released_at)
            : o.issueDate 
              ? parseISO(o.issueDate) 
              : parseISO(o.createdDate);
          return sum + differenceInDays(today, start);
        }, 0) / pendingOrders.length
      )
    : 0;
  
  return {
    total: pendingOrders.length,
    avgWaitTime,
    awaitingAnalysis: pendingOrders.filter(o => o.status === 'in_analysis').length,
    noDefinition: pendingOrders.filter(o => o.status === 'pending').length
  };
};

/**
 * Calcula tempo mínimo, máximo e mediana de produção
 */
export const calculateProductionTimeRange = (orders: Order[]) => {
  const productionOrders = orders.filter(o => 
    ['in_production', 'separation_started', 'production_completed', 'completed'].includes(o.status)
  );
  
  if (productionOrders.length === 0) {
    return { min: 0, max: 0, median: 0 };
  }
  
  const today = new Date();
  const times = productionOrders.map(order => {
    const start = order.issueDate ? parseISO(order.issueDate) : parseISO(order.createdDate);
    const end = order.status === 'completed' || order.status === 'delivered'
      ? parseISO(order.deliveryDeadline)
      : today;
    return differenceInDays(end, start);
  }).sort((a, b) => a - b);
  
  const min = times[0] || 0;
  const max = times[times.length - 1] || 0;
  const median = times[Math.floor(times.length / 2)] || 0;
  
  return { min, max, median };
};

/**
 * Separa pedidos no prazo vs atrasados
 */
export const separateOrdersByDeadline = (orders: Order[]) => {
  const today = new Date();
  const activeOrders = orders.filter(o => 
    !['delivered', 'completed', 'cancelled'].includes(o.status)
  );
  
  const onTime = activeOrders.filter(o => {
    const deadline = parseISO(o.deliveryDeadline);
    return differenceInDays(deadline, today) >= 0;
  });
  
  const late = activeOrders.filter(o => {
    const deadline = parseISO(o.deliveryDeadline);
    return differenceInDays(deadline, today) < 0;
  });
  
  return {
    onTime: onTime.length,
    late: late.length
  };
};

/**
 * Calcula pedidos iniciados hoje
 */
export const getOrdersStartedToday = (orders: Order[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return orders.filter(o => {
    const created = parseISO(o.createdDate);
    created.setHours(0, 0, 0, 0);
    return created.getTime() === today.getTime();
  }).length;
};

/**
 * Calcula pedidos finalizando hoje (prazo hoje)
 */
export const getOrdersEndingToday = (orders: Order[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return orders.filter(o => {
    if (['delivered', 'completed', 'cancelled'].includes(o.status)) return false;
    const deadline = parseISO(o.deliveryDeadline);
    deadline.setHours(0, 0, 0, 0);
    return deadline.getTime() === today.getTime();
  }).length;
};

import { differenceInDays, differenceInHours, parseISO } from 'date-fns';
import type { Order } from '@/components/Dashboard';
import { supabase } from '@/integrations/supabase/client';
import type { OrderItem } from '@/components/AddOrderDialog';

// Contar itens por origem
export const countItemsBySource = (items: OrderItem[]) => {
  return {
    inStock: items.filter(i => i.item_source_type === 'in_stock' || !i.item_source_type).length,
    production: items.filter(i => i.item_source_type === 'production').length,
    outOfStock: items.filter(i => i.item_source_type === 'out_of_stock').length
  };
};

// Calcular tempo médio de produção apenas para itens de produção
export const calculateAverageProductionTimeForItems = (items: OrderItem[]): number => {
  const productionItems = items.filter(i => 
    i.item_source_type === 'production' && i.production_estimated_date
  );
  
  if (productionItems.length === 0) return 0;
  
  const totalDays = productionItems.reduce((sum, item) => {
    const requested = new Date(item.deliveryDate);
    const completed = item.production_estimated_date 
      ? new Date(item.production_estimated_date)
      : new Date();
    return sum + Math.abs(differenceInDays(completed, requested));
  }, 0);
  
  return Math.round(totalDays / productionItems.length);
};

// Identificar pedidos com muitos itens sem estoque
export const findOrdersWithStockIssues = (orders: Order[]): Order[] => {
  return orders.filter(order => {
    const items = order.items || [];
    if (items.length === 0) return false;
    const outOfStockCount = items.filter(i => i.item_source_type === 'out_of_stock').length;
    return outOfStockCount > 0 && outOfStockCount / items.length >= 0.3; // 30% ou mais sem estoque
  });
};

// Calcular tempo médio em uma fase (em dias)
export const calculateAverageTimeInPhase = (
  orders: Order[], 
  phase: string
): number => {
  const phaseOrders = orders.filter(o => isInPhase(o.status, phase));
  
  if (phaseOrders.length === 0) return 0;
  
  const totalDays = phaseOrders.reduce((sum, order) => {
    // Usar issueDate se disponível, senão usar createdDate
    const start = order.issueDate ? parseISO(order.issueDate) : parseISO(order.createdDate);
    const end = new Date();
    return sum + differenceInDays(end, start);
  }, 0);
  
  return Math.round(totalDays / phaseOrders.length);
};

// Taxa de cumprimento de prazo (%)
export const calculateOnTimeRate = (
  orders: Order[], 
  targetDays: number
): number => {
  const completedOrders = orders.filter(o => 
    o.status === 'completed' || o.status === 'delivered'
  );
  
  if (completedOrders.length === 0) return 100;
  
  const onTimeCount = completedOrders.filter(order => {
    // Usar issueDate se disponível, senão usar createdDate
    const start = order.issueDate ? parseISO(order.issueDate) : parseISO(order.createdDate);
    const end = parseISO(order.deliveryDeadline);
    const actualDays = differenceInDays(end, start);
    return actualDays <= targetDays;
  }).length;
  
  return Math.round((onTimeCount / completedOrders.length) * 100);
};

// Contar mudanças de prazo por período
export const countDateChanges = async (
  days: number = 7
): Promise<number> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { count, error } = await supabase
    .from('delivery_date_changes')
    .select('*', { count: 'exact', head: true })
    .gte('changed_at', startDate.toISOString());
  
  if (error) {
    console.error('Error counting date changes:', error);
    return 0;
  }
  
  return count || 0;
};

// Identificar pedidos com múltiplas mudanças
export const findProblematicOrders = async (
  threshold: number = 3
): Promise<Array<{ order_id: string; change_count: number }>> => {
  try {
    const { data, error } = await supabase
      .from('delivery_date_changes')
      .select('order_id');
    
    if (error) throw error;
    if (!data) return [];
    
    // Contar mudanças por pedido
    const countMap = new Map<string, number>();
    data.forEach(item => {
      const count = countMap.get(item.order_id) || 0;
      countMap.set(item.order_id, count + 1);
    });
    
    // Filtrar pedidos acima do threshold
    return Array.from(countMap.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([order_id, change_count]) => ({ order_id, change_count }))
      .sort((a, b) => b.change_count - a.change_count);
  } catch (error) {
    console.error('Error finding problematic orders:', error);
    return [];
  }
};

// Calcular tempo médio de produção para SSM (em dias)
export const calculateAverageProductionTime = (orders: Order[]): number => {
  const productionOrders = orders.filter(o => 
    ['in_production', 'separation_started', 'production_completed', 'completed'].includes(o.status)
  );
  
  if (productionOrders.length === 0) return 0;
  
  const totalDays = productionOrders.reduce((sum, order) => {
    // Usar issueDate se disponível, senão usar createdDate
    const start = order.issueDate ? parseISO(order.issueDate) : parseISO(order.createdDate);
    const end = order.status === 'completed' || order.status === 'delivered'
      ? parseISO(order.deliveryDeadline)
      : new Date();
    return sum + differenceInDays(end, start);
  }, 0);
  
  return Math.round(totalDays / productionOrders.length);
};

// Helper para verificar se um status pertence a uma fase
const isInPhase = (status: string, phase: string): boolean => {
  const phaseMap: Record<string, string[]> = {
    preparation: ['pending', 'in_analysis', 'awaiting_approval', 'planned'],
    production: ['separation_started', 'in_production', 'awaiting_material', 'production_completed'],
    lab: ['awaiting_lab', 'in_lab_analysis', 'lab_completed'],
    packaging: ['in_quality_check', 'in_packaging', 'ready_for_shipping'],
    logistics: ['released_for_shipping', 'in_expedition', 'in_transit', 'pickup_scheduled', 'awaiting_pickup', 'collected']
  };
  
  return phaseMap[phase]?.includes(status) || false;
};

// Obter contagem de pedidos por fase
export const getOrderCountByPhase = (orders: Order[], phase: string): number => {
  return orders.filter(o => isInPhase(o.status, phase)).length;
};

// Calcular dias desde criação/emissão do pedido
export const calculateDaysOpen = (createdDate: string, issueDate?: string): number => {
  // Usar issueDate se disponível, senão usar createdDate
  const startDate = issueDate ? parseISO(issueDate) : parseISO(createdDate);
  const today = new Date();
  return differenceInDays(today, startDate);
};

// Calcular dias até o prazo de entrega
export const calculateDaysUntilDeadline = (deliveryDate: string): number => {
  const deadline = parseISO(deliveryDate);
  const today = new Date();
  return differenceInDays(deadline, today);
};

// Determinar status do prazo baseado nos dias restantes
export const getDeadlineStatus = (daysUntil: number): 'good' | 'warning' | 'critical' => {
  if (daysUntil < 0) return 'critical'; // Atrasado
  if (daysUntil < 3) return 'critical'; // Menos de 3 dias
  if (daysUntil <= 7) return 'warning'; // 3-7 dias
  return 'good'; // Mais de 7 dias
};

// Calcular informações de entrega parcial
export const getPartialDeliveryInfo = (items: OrderItem[]): {
  delivered: number;
  total: number;
  percentage: number;
} => {
  if (items.length === 0) {
    return { delivered: 0, total: 0, percentage: 0 };
  }

  const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const totalDelivered = items.reduce((sum, item) => sum + item.deliveredQuantity, 0);
  const percentage = totalRequested > 0 ? Math.round((totalDelivered / totalRequested) * 100) : 0;

  return {
    delivered: totalDelivered,
    total: totalRequested,
    percentage
  };
};

// Contar mudanças de prazo de um pedido específico
export const countOrderDateChanges = async (orderId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('delivery_date_changes')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    if (error) {
      console.error('Error counting order date changes:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in countOrderDateChanges:', error);
    return 0;
  }
};

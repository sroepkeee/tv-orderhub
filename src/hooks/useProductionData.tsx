import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductionItem, ProductionStats } from "@/types/production";
import { differenceInDays } from "date-fns";

export const useProductionData = () => {
  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['production-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner (
            id,
            order_number,
            customer_name,
            status
          )
        `)
        .not('orders.status', 'in', '(delivered,completed,cancelled)')
        .not('item_status', 'eq', 'completed')
        .order('delivery_date', { ascending: true });

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        orderId: item.order_id,
        orderNumber: item.orders.order_number,
        itemCode: item.item_code,
        itemDescription: item.item_description,
        unit: item.unit,
        requestedQuantity: Number(item.requested_quantity),
        deliveredQuantity: Number(item.delivered_quantity),
        warehouse: item.warehouse,
        deliveryDate: item.delivery_date,
        item_status: item.item_status || 'pending',
        item_source_type: item.item_source_type,
        sla_days: item.sla_days,
        sla_deadline: item.sla_deadline,
        current_phase: item.current_phase,
        created_at: item.created_at,
        customerName: item.orders.customer_name,
        orderStatus: item.orders.status,
        production_estimated_date: item.production_estimated_date,
        purchase_action_started: item.purchase_action_started,
        purchase_action_started_at: item.purchase_action_started_at,
        purchase_action_started_by: item.purchase_action_started_by,
      })) as ProductionItem[];
    },
    staleTime: 30000, // 30 segundos
  });

  const calculateStats = (items: ProductionItem[]): ProductionStats => {
    const today = new Date();
    
    return {
      total: items.length,
      awaiting_production: items.filter(i => i.item_status === 'awaiting_production').length,
      pending: items.filter(i => i.item_status === 'pending').length,
      purchase_required: items.filter(i => i.item_status === 'purchase_required').length,
      purchase_requested: items.filter(i => i.item_status === 'purchase_requested').length,
      completed: items.filter(i => i.item_status === 'completed').length,
      in_stock: items.filter(i => i.item_status === 'in_stock').length,
      critical: items.filter(i => {
        const daysUntil = differenceInDays(new Date(i.deliveryDate), today);
        return daysUntil <= 3 && daysUntil >= 0 && i.item_status !== 'completed';
      }).length,
    };
  };

  const stats = calculateStats(items);

  return {
    items,
    stats,
    isLoading,
    error,
    refetch,
  };
};

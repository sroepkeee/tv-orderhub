import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export interface TechnicianFromOrders {
  name: string;
  orderCount: number;
  totalItems: number;
  orders: {
    id: string;
    order_number: string;
    order_type: string;
    customer_name: string;
    items_count: number;
    created_at: string;
  }[];
}

export function useTechnicianFromOrders() {
  const [techniciansFromOrders, setTechniciansFromOrders] = useState<TechnicianFromOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useOrganizationId();

  const fetchTechniciansFromOrders = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Buscar pedidos de remessa conserto/garantia
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_type,
          customer_name,
          created_at,
          order_items(id)
        `)
        .eq('organization_id', organizationId)
        .in('order_type', ['remessa_conserto', 'remessa_garantia'])
        .not('customer_name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por customer_name
      const technicianMap = new Map<string, TechnicianFromOrders>();

      orders?.forEach((order) => {
        const name = order.customer_name?.trim().toUpperCase();
        if (!name) return;

        const existing = technicianMap.get(name);
        const itemsCount = Array.isArray(order.order_items) ? order.order_items.length : 0;
        
        const orderInfo = {
          id: order.id,
          order_number: order.order_number,
          order_type: order.order_type,
          customer_name: order.customer_name || '',
          items_count: itemsCount,
          created_at: order.created_at,
        };

        if (existing) {
          existing.orderCount++;
          existing.totalItems += itemsCount;
          existing.orders.push(orderInfo);
        } else {
          technicianMap.set(name, {
            name,
            orderCount: 1,
            totalItems: itemsCount,
            orders: [orderInfo],
          });
        }
      });

      // Converter para array e ordenar por quantidade de pedidos
      const technicians = Array.from(technicianMap.values())
        .sort((a, b) => b.orderCount - a.orderCount);

      setTechniciansFromOrders(technicians);
    } catch (error) {
      console.error('Error fetching technicians from orders:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTechniciansFromOrders();
  }, [fetchTechniciansFromOrders]);

  return {
    techniciansFromOrders,
    loading,
    refetch: fetchTechniciansFromOrders,
  };
}

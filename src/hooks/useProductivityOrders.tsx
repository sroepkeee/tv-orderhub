import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";
import { format } from "date-fns";

export interface ProductivityOrderRow {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  status: string;
  order_type: string;
  order_category: string | null;
  priority: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  updated_at: string;
  delivery_date: string | null;
  shipping_date: string | null;
  sla_status: string | null;
  requires_firmware: boolean | null;
  requires_image: boolean | null;
}

export interface ProductivityOrdersFilters {
  startDate: Date | undefined;
  endDate: Date | undefined;
  userIds?: string[];
  orderTypes?: string[];
  priorities?: string[];
  enabled?: boolean;
  /** When true, also includes orders not yet completed (uses created_at as date filter). */
  includePending?: boolean;
}

export function useProductivityOrders({
  startDate,
  endDate,
  userIds,
  orderTypes,
  priorities,
  enabled = true,
  includePending = false,
}: ProductivityOrdersFilters) {
  const { organizationId } = useOrganizationId();

  return useQuery({
    queryKey: [
      "productivity-orders",
      organizationId,
      startDate?.toISOString(),
      endDate?.toISOString(),
      userIds?.sort().join(","),
      orderTypes?.sort().join(","),
      priorities?.sort().join(","),
      includePending,
    ],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivityOrderRow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      let query = (supabase as any)
        .from("orders")
        .select(`
          id, order_number, customer_name, status, order_type, order_category, priority,
          user_id, created_at, updated_at, delivery_date, shipping_date, sla_status,
          requires_firmware, requires_image,
          profiles:user_id ( full_name )
        `)
        .eq("organization_id", organizationId)
        .gte("created_at", format(startDate, "yyyy-MM-dd"))
        .lte("created_at", format(endDate, "yyyy-MM-dd") + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!includePending) {
        query = query.in("status", ["completed", "delivered"]);
      }

      if (userIds && userIds.length > 0) {
        query = query.in("user_id", userIds);
      }
      if (orderTypes && orderTypes.length > 0) {
        query = query.in("order_type", orderTypes);
      }
      if (priorities && priorities.length > 0) {
        query = query.in("priority", priorities);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        order_number: row.order_number,
        customer_name: row.customer_name,
        status: row.status,
        order_type: row.order_type,
        order_category: row.order_category,
        priority: row.priority,
        user_id: row.user_id,
        user_name: row.profiles?.full_name || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        delivery_date: row.delivery_date,
        shipping_date: row.shipping_date,
        sla_status: row.sla_status,
        requires_firmware: row.requires_firmware,
        requires_image: row.requires_image,
      }));
    },
  });
}

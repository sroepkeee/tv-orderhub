import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";
import { format } from "date-fns";

export interface ProductivityCycleTimeRow {
  activity_date: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  order_type: string;
  order_category: string;
  priority: string;
  orders_count: number;
  avg_cycle_days: number | null;
  min_cycle_days: number | null;
  max_cycle_days: number | null;
}

interface Params {
  startDate: Date | undefined;
  endDate: Date | undefined;
  enabled?: boolean;
}

export function useProductivityCycleTime({ startDate, endDate, enabled = true }: Params) {
  const { organizationId } = useOrganizationId();

  return useQuery({
    queryKey: ["productivity-cycle", organizationId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivityCycleTimeRow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      const { data, error } = await (supabase as any)
        .from("v_productivity_cycle_time")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("activity_date", format(startDate, "yyyy-MM-dd"))
        .lte("activity_date", format(endDate, "yyyy-MM-dd"))
        .order("activity_date", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        activity_date: row.activity_date,
        user_id: row.user_id,
        user_name: row.user_name || "Desconhecido",
        user_email: row.user_email,
        order_type: row.order_type || "unknown",
        order_category: row.order_category || "unknown",
        priority: row.priority || "normal",
        orders_count: Number(row.orders_count) || 0,
        avg_cycle_days: row.avg_cycle_days !== null ? Number(row.avg_cycle_days) : null,
        min_cycle_days: row.min_cycle_days !== null ? Number(row.min_cycle_days) : null,
        max_cycle_days: row.max_cycle_days !== null ? Number(row.max_cycle_days) : null,
      }));
    },
  });
}

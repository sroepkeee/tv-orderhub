import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";
import { format } from "date-fns";

export interface ProductivitySLARow {
  activity_date: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  order_type: string;
  order_category: string;
  priority: string;
  total_completed: number;
  on_time_count: number;
  late_count: number;
  sla_on_time: number;
  sla_at_risk: number;
  sla_late: number;
  on_time_percent: number | null;
}

interface Params {
  startDate: Date | undefined;
  endDate: Date | undefined;
  enabled?: boolean;
}

export function useProductivitySLA({ startDate, endDate, enabled = true }: Params) {
  const { organizationId } = useOrganizationId();

  return useQuery({
    queryKey: ["productivity-sla", organizationId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivitySLARow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      const { data, error } = await (supabase as any)
        .from("v_productivity_sla_daily")
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
        total_completed: Number(row.total_completed) || 0,
        on_time_count: Number(row.on_time_count) || 0,
        late_count: Number(row.late_count) || 0,
        sla_on_time: Number(row.sla_on_time) || 0,
        sla_at_risk: Number(row.sla_at_risk) || 0,
        sla_late: Number(row.sla_late) || 0,
        on_time_percent: row.on_time_percent !== null ? Number(row.on_time_percent) : null,
      }));
    },
  });
}

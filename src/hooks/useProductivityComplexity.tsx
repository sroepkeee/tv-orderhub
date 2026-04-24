import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";
import { format } from "date-fns";

export interface ProductivityComplexityRow {
  activity_date: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  order_type: string;
  order_category: string;
  total_orders: number;
  requires_firmware_count: number;
  requires_image_count: number;
  technical_complex_count: number;
  lab_processed_count: number;
  complexity_percent: number | null;
}

interface Params {
  startDate: Date | undefined;
  endDate: Date | undefined;
  enabled?: boolean;
}

export function useProductivityComplexity({ startDate, endDate, enabled = true }: Params) {
  const { organizationId } = useOrganizationId();

  return useQuery({
    queryKey: ["productivity-complexity", organizationId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivityComplexityRow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      const { data, error } = await (supabase as any)
        .from("v_productivity_complexity_daily")
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
        total_orders: Number(row.total_orders) || 0,
        requires_firmware_count: Number(row.requires_firmware_count) || 0,
        requires_image_count: Number(row.requires_image_count) || 0,
        technical_complex_count: Number(row.technical_complex_count) || 0,
        lab_processed_count: Number(row.lab_processed_count) || 0,
        complexity_percent: row.complexity_percent !== null ? Number(row.complexity_percent) : null,
      }));
    },
  });
}

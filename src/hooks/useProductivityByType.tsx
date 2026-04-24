import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";
import { format } from "date-fns";

export interface ProductivityByTypeRow {
  activity_date: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  order_type: string;
  order_category: string;
  priority: string;
  orders_imported: number;
  orders_invoice_requested: number;
  orders_completed: number;
  unique_customers: number;
}

interface Params {
  startDate: Date | undefined;
  endDate: Date | undefined;
  enabled?: boolean;
}

export function useProductivityByType({ startDate, endDate, enabled = true }: Params) {
  const { organizationId } = useOrganizationId();

  return useQuery({
    queryKey: ["productivity-by-type", organizationId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivityByTypeRow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      const { data, error } = await (supabase as any)
        .from("v_productivity_by_type_daily")
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
        orders_imported: Number(row.orders_imported) || 0,
        orders_invoice_requested: Number(row.orders_invoice_requested) || 0,
        orders_completed: Number(row.orders_completed) || 0,
        unique_customers: Number(row.unique_customers) || 0,
      }));
    },
  });
}

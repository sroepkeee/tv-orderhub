import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";
import { format } from "date-fns";

export type ProductivityView = "imported" | "invoice_requested" | "completed";

export interface ProductivityRow {
  date: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  count: number;
  unique_customers?: number;
}

interface UseProductivityMetricsParams {
  view: ProductivityView;
  startDate: Date | undefined;
  endDate: Date | undefined;
  enabled?: boolean;
}

const VIEW_CONFIG = {
  imported: {
    table: "v_orders_imported_daily",
    dateCol: "import_date",
    countCol: "orders_imported",
  },
  invoice_requested: {
    table: "v_orders_invoice_requested_daily",
    dateCol: "request_date",
    countCol: "orders_invoice_requested",
  },
  completed: {
    table: "v_orders_completed_daily",
    dateCol: "completion_date",
    countCol: "orders_completed",
  },
} as const;

export function useProductivityMetrics({
  view,
  startDate,
  endDate,
  enabled = true,
}: UseProductivityMetricsParams) {
  const { organizationId } = useOrganizationId();
  const config = VIEW_CONFIG[view];

  return useQuery({
    queryKey: ["productivity", view, organizationId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivityRow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      const { data, error } = await (supabase as any)
        .from(config.table)
        .select("*")
        .eq("organization_id", organizationId)
        .gte(config.dateCol, format(startDate, "yyyy-MM-dd"))
        .lte(config.dateCol, format(endDate, "yyyy-MM-dd"))
        .order(config.dateCol, { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        date: row[config.dateCol],
        user_id: row.user_id,
        user_name: row.user_name || "Desconhecido",
        user_email: row.user_email,
        count: Number(row[config.countCol]) || 0,
        unique_customers: row.unique_customers != null ? Number(row.unique_customers) : undefined,
      }));
    },
  });
}

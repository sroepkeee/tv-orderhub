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
  /** Specific statuses to filter by. Overrides includePending/default behavior when provided. */
  statuses?: string[];
}

const INVOICE_STATUSES = [
  "invoice_requested",
  "ready_to_invoice",
  "pending_invoice_request",
  "awaiting_invoice",
  "invoice_issued",
  "invoice_sent",
];

const COMPLETION_STATUSES = ["completed", "delivered"];

function arraysShareAny(a: string[], b: string[]) {
  return a.some((x) => b.includes(x));
}

export function useProductivityOrders({
  startDate,
  endDate,
  userIds,
  orderTypes,
  priorities,
  enabled = true,
  includePending = false,
  statuses,
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
      statuses?.sort().join(","),
    ],
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    queryFn: async (): Promise<ProductivityOrderRow[]> => {
      if (!organizationId || !startDate || !endDate) return [];

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd") + "T23:59:59";

      // ===== Modo "histórico de transição" =====
      // Quando o filtro statuses for de fases transitórias (Faturamento) ou terminais
      // (Concluído), a data do gráfico vem de order_history.changed_at, não de
      // orders.created_at. Buscamos as transições no período e depois carregamos
      // os pedidos correspondentes.
      const useHistoryLookup =
        !!statuses &&
        (arraysShareAny(statuses, INVOICE_STATUSES) ||
          arraysShareAny(statuses, COMPLETION_STATUSES));

      let orderIds: string[] | null = null;

      if (useHistoryLookup && statuses) {
        const { data: historyRows, error: historyErr } = await (supabase as any)
          .from("order_history")
          .select("order_id")
          .eq("organization_id", organizationId)
          .in("new_status", statuses)
          .gte("changed_at", startStr)
          .lte("changed_at", endStr)
          .limit(2000);

        if (historyErr) throw historyErr;
        orderIds = Array.from(
          new Set((historyRows || []).map((r: any) => r.order_id as string))
        );

        if (orderIds.length === 0) return [];
      }

      let query = (supabase as any)
        .from("orders")
        .select(`
          id, order_number, customer_name, status, order_type, order_category, priority,
          user_id, created_at, updated_at, delivery_date, shipping_date, sla_status,
          requires_firmware, requires_image,
          profiles:user_id ( full_name )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (useHistoryLookup && orderIds) {
        query = query.in("id", orderIds);
      } else {
        query = query
          .gte("created_at", startStr)
          .lte("created_at", endStr);

        if (statuses && statuses.length > 0) {
          query = query.in("status", statuses);
        } else if (!includePending) {
          query = query.in("status", COMPLETION_STATUSES);
        }
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

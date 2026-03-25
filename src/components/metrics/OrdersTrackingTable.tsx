import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/components/Dashboard";
import type { OrderItem } from "@/components/AddOrderDialog";
import { calculateDaysOpen, calculateDaysUntilDeadline, getDeadlineStatus, getPartialDeliveryInfo } from "@/lib/metrics";
import { Calendar, Package, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, cleanItemDescription } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getStatusLabel } from "@/lib/statusLabels";
import { format } from "date-fns";

interface OrdersTrackingTableProps {
  searchQuery?: string;
  onOrderClick: (order: Order) => void;
}

interface OrderWithDetails extends Order {
  items?: OrderItem[];
  dateChangesCount?: number;
}

type SortField = 'orderNumber' | 'client' | 'orderType' | 'itemsQuantity' | 'status' | 'issueDate' | 'deliveryDeadline' | 'daysOpen' | 'deadline' | 'dateChanges';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [10, 20, 50, 100];

const ORDER_PHASES = [
  { value: 'almox_ssm', label: 'Almox SSM' },
  { value: 'order_generation', label: 'Gerar Ordem' },
  { value: 'purchases', label: 'Compras' },
  { value: 'almox_general', label: 'Almox Geral' },
  { value: 'production_client', label: 'Clientes' },
  { value: 'production_stock', label: 'Estoque' },
  { value: 'balance_generation', label: 'Gerar Saldo' },
  { value: 'laboratory', label: 'Laboratório' },
  { value: 'packaging', label: 'Embalagem' },
  { value: 'freight_quote', label: 'Cotação de Frete' },
  { value: 'ready_to_invoice', label: 'À Faturar' },
  { value: 'invoicing', label: 'Faturamento' },
  { value: 'logistics', label: 'Expedição' },
  { value: 'in_transit', label: 'Em Trânsito' },
  { value: 'completion', label: 'Conclusão' },
];

const STATUS_PHASE_MAP: Record<string, string> = {
  'almox_ssm_pending': 'almox_ssm', 'almox_ssm_received': 'almox_ssm',
  'order_generation_pending': 'order_generation', 'order_in_creation': 'order_generation', 'order_generated': 'order_generation',
  'purchase_pending': 'purchases', 'purchase_in_progress': 'purchases', 'purchase_completed': 'purchases',
  'almox_general_received': 'almox_general', 'almox_general_separating': 'almox_general', 'almox_general_ready': 'almox_general',
  'separation_started': 'production_client', 'in_production': 'production_client', 'awaiting_material': 'production_client', 'separation_completed': 'production_client', 'production_completed': 'production_client',
  'balance_calculation': 'balance_generation', 'balance_review': 'balance_generation', 'balance_approved': 'balance_generation',
  'awaiting_lab': 'laboratory', 'in_lab_analysis': 'laboratory', 'lab_completed': 'laboratory',
  'in_quality_check': 'packaging', 'in_packaging': 'packaging', 'ready_for_shipping': 'packaging',
  'freight_quote_requested': 'freight_quote', 'freight_quote_received': 'freight_quote', 'freight_approved': 'freight_quote',
  'ready_to_invoice': 'ready_to_invoice', 'pending_invoice_request': 'ready_to_invoice',
  'invoice_requested': 'invoicing', 'awaiting_invoice': 'invoicing', 'invoice_issued': 'invoicing', 'invoice_sent': 'invoicing',
  'released_for_shipping': 'logistics', 'in_expedition': 'logistics', 'pickup_scheduled': 'logistics', 'awaiting_pickup': 'logistics',
  'in_transit': 'in_transit', 'collected': 'in_transit',
  'delivered': 'completion', 'completed': 'completion', 'cancelled': 'completion', 'delayed': 'completion', 'returned': 'completion', 'pending': 'completion', 'on_hold': 'completion',
};

const getPhaseFromStatus = (status: string): string => STATUS_PHASE_MAP[status] || 'completion';

export function OrdersTrackingTable({ searchQuery = "", onOrderClick }: OrdersTrackingTableProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'good'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [ordersWithDetails, setOrdersWithDetails] = useState<OrderWithDetails[]>([]);
  const [orderTypes, setOrderTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isDeadlineFilterOpen, setIsDeadlineFilterOpen] = useState(false);
  const [isPhaseFilterOpen, setIsPhaseFilterOpen] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, customer_name, status, order_type, priority,
          created_at, updated_at, delivery_date, issue_date, order_category, notes, user_id,
          totvs_order_number,
          order_items (id, item_code, item_description, requested_quantity, 
                       delivered_quantity, unit, item_source_type, item_status, 
                       sla_days, sla_deadline, delivery_date, user_id, warehouse,
                       is_imported, import_lead_time_days, current_phase, phase_started_at,
                       production_estimated_date, received_status, unit_price, 
                       discount_percent, total_value, ipi_percent, icms_percent)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Server-side search filter
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`order_number.ilike.${q},customer_name.ilike.${q},totvs_order_number.ilike.${q}`);
      }

      // Pagination
      const offset = (currentPage - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      setTotalCount(count || 0);

      const transformOrder = (dbOrder: any): OrderWithDetails => {
        const createdDate = new Date(dbOrder.created_at);
        const now = new Date();
        const daysOpen = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        const items: OrderItem[] = (dbOrder.order_items || []).map((item: any) => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: cleanItemDescription(item.item_description),
          requestedQuantity: item.requested_quantity,
          deliveredQuantity: item.delivered_quantity,
          unit: item.unit,
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          userId: item.user_id,
          item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
          item_status: item.item_status,
          production_estimated_date: item.production_estimated_date || undefined,
          received_status: item.received_status as 'pending' | 'partial' | 'completed',
        }));

        return {
          id: dbOrder.id,
          type: dbOrder.order_type as any,
          priority: dbOrder.priority as any,
          orderNumber: dbOrder.order_number,
          item: dbOrder.customer_name,
          description: dbOrder.notes || "",
          quantity: 0,
          createdDate: createdDate.toISOString().split('T')[0],
          issueDate: dbOrder.issue_date ? new Date(dbOrder.issue_date).toISOString().split('T')[0] : undefined,
          status: dbOrder.status as any,
          client: dbOrder.customer_name,
          deliveryDeadline: dbOrder.delivery_date,
          deskTicket: dbOrder.order_number,
          order_category: dbOrder.order_category,
          daysOpen,
          items,
        };
      };

      const transformedOrders = (data || []).map(transformOrder);

      // Batch fetch date changes
      const orderIds = transformedOrders.map(o => o.id);
      let dateChangesMap: Record<string, number> = {};

      if (orderIds.length > 0) {
        const { data: changesData } = await supabase
          .from('delivery_date_changes')
          .select('order_id')
          .in('order_id', orderIds);

        if (changesData) {
          dateChangesMap = changesData.reduce((acc: Record<string, number>, row) => {
            acc[row.order_id] = (acc[row.order_id] || 0) + 1;
            return acc;
          }, {});
        }
      }

      const enriched = transformedOrders.map(order => ({
        ...order,
        dateChangesCount: dateChangesMap[order.id] || 0,
      }));

      setOrdersWithDetails(enriched);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    supabase
      .from('order_type_config')
      .select('*')
      .order('display_name')
      .then(({ data }) => {
        if (data) setOrderTypes(data);
      });
  }, []);

  // Reset to page 1 when search or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const getFilteredOrders = () => {
    let filtered = ordersWithDetails;

    if (filter !== 'all') {
      filtered = filtered.filter(order => {
        const daysUntil = calculateDaysUntilDeadline(order.deliveryDeadline);
        return getDeadlineStatus(daysUntil) === filter;
      });
    }

    if (orderTypeFilter !== 'all') {
      filtered = filtered.filter(order => order.type === orderTypeFilter);
    }

    if (phaseFilter !== 'all') {
      filtered = filtered.filter(order => getPhaseFromStatus(order.status) === phaseFilter);
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any, bValue: any;
        switch (sortField) {
          case 'orderNumber': aValue = a.orderNumber; bValue = b.orderNumber; break;
          case 'client': aValue = a.client.toLowerCase(); bValue = b.client.toLowerCase(); break;
          case 'orderType': aValue = a.type?.toLowerCase() || ''; bValue = b.type?.toLowerCase() || ''; break;
          case 'itemsQuantity':
            aValue = (a.items || []).reduce((s, i) => s + i.requestedQuantity, 0);
            bValue = (b.items || []).reduce((s, i) => s + i.requestedQuantity, 0); break;
          case 'status': aValue = a.status; bValue = b.status; break;
          case 'issueDate': aValue = a.issueDate ? new Date(a.issueDate).getTime() : 0; bValue = b.issueDate ? new Date(b.issueDate).getTime() : 0; break;
          case 'deliveryDeadline': aValue = new Date(a.deliveryDeadline).getTime(); bValue = new Date(b.deliveryDeadline).getTime(); break;
          case 'daysOpen': aValue = calculateDaysOpen(a.createdDate); bValue = calculateDaysOpen(b.createdDate); break;
          case 'deadline': aValue = calculateDaysUntilDeadline(a.deliveryDeadline); bValue = calculateDaysUntilDeadline(b.deliveryDeadline); break;
          case 'dateChanges': aValue = a.dateChangesCount || 0; bValue = b.dateChangesCount || 0; break;
          default: return 0;
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const getOrderTypeBadge = (type: string) => {
    const typeConfig = orderTypes.find(t => t.order_type === type);
    if (typeConfig) {
      const categoryColors: Record<string, string> = {
        vendas: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
        estoque: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        producao: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        logistica: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        outros: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
      };
      const colorClass = categoryColors[typeConfig.category] || categoryColors.outros;
      return (
        <Badge variant="outline" className={cn("text-xs font-medium", colorClass)}>
          {typeConfig.icon} {typeConfig.display_name}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20">
        📋 {type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const label = getStatusLabel(status);
    const statusColors: Record<string, string> = {
      "completed": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      "delivered": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      "production_completed": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      "separation_completed": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      "invoice_issued": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      "collected": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      "in_production": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "in_transit": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "in_packaging": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "in_quality_check": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "separation_started": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "pending": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "planned": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "awaiting_approval": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "awaiting_material": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "awaiting_pickup": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "invoice_requested": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "awaiting_invoice": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "freight_quote_requested": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      "on_hold": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      "delayed": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      "freight_quote_received": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      "freight_approved": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "ready_for_shipping": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "released_for_shipping": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "in_expedition": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "pickup_scheduled": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "invoice_sent": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "cancelled": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      "returned": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      "in_analysis": "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
    };
    const colorClass = statusColors[status] || "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
    return <Badge variant="outline" className={cn("text-xs font-medium", colorClass)}>{label}</Badge>;
  };

  const getDeadlineBadge = (daysUntil: number) => {
    const status = getDeadlineStatus(daysUntil);
    const bgColor = status === 'critical' ? 'bg-destructive/10 text-destructive' : status === 'warning' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-green-500/10 text-green-600 dark:text-green-500';
    const label = daysUntil < 0 ? `${Math.abs(daysUntil)}d atrasado` : daysUntil === 0 ? 'Hoje' : `${daysUntil}d restantes`;
    return <div className={`px-3 py-1 rounded-md text-sm font-semibold ${bgColor} text-center min-w-[90px]`}>{label}</div>;
  };

  const getItemSourceBadges = (items: OrderItem[]) => {
    const inStock = items.filter(i => i.item_source_type === 'in_stock' || !i.item_source_type).length;
    const production = items.filter(i => i.item_source_type === 'production').length;
    const outOfStock = items.filter(i => i.item_source_type === 'out_of_stock').length;
    return (
      <div className="flex gap-1 flex-wrap">
        {inStock > 0 && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">{inStock} Est.</Badge>}
        {production > 0 && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">{production} Prod.</Badge>}
        {outOfStock > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">{outOfStock} S/Est.</Badge>}
      </div>
    );
  };

  const filteredOrders = getFilteredOrders();

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          📋 Acompanhamento Detalhado de Pedidos
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Histórico completo de todos os pedidos — {totalCount} pedidos encontrados
        </p>

        {/* Filtros por Prazo */}
        <div className="space-y-3">
          <Collapsible open={isDeadlineFilterOpen} onOpenChange={setIsDeadlineFilterOpen}>
            <div>
              <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Filtrar por Prazo</h3>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform mb-2", isDeadlineFilterOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
                    Todos ({ordersWithDetails.length})
                  </Button>
                  <Button variant={filter === 'critical' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('critical')}>
                    Críticos ({ordersWithDetails.filter(o => getDeadlineStatus(calculateDaysUntilDeadline(o.deliveryDeadline)) === 'critical').length})
                  </Button>
                  <Button variant={filter === 'warning' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('warning')} className={filter === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}>
                    Atenção ({ordersWithDetails.filter(o => getDeadlineStatus(calculateDaysUntilDeadline(o.deliveryDeadline)) === 'warning').length})
                  </Button>
                  <Button variant={filter === 'good' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('good')} className={filter === 'good' ? 'bg-green-600 hover:bg-green-700' : ''}>
                    Em dia ({ordersWithDetails.filter(o => getDeadlineStatus(calculateDaysUntilDeadline(o.deliveryDeadline)) === 'good').length})
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Filtros por Tipo de Pedido */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Filtrar por Tipo de Pedido</h3>
            <div className="flex gap-2 flex-wrap">
              <Button variant={orderTypeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setOrderTypeFilter('all')}>
                Todos os Tipos ({ordersWithDetails.length})
              </Button>
              {orderTypes.map(typeConfig => {
                const count = ordersWithDetails.filter(o => o.type === typeConfig.order_type).length;
                if (count === 0) return null;
                return (
                  <Button key={typeConfig.order_type} variant={orderTypeFilter === typeConfig.order_type ? 'default' : 'outline'} size="sm" onClick={() => setOrderTypeFilter(typeConfig.order_type)}>
                    {typeConfig.icon} {typeConfig.display_name} ({count})
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Filtros por Fase */}
          <Collapsible open={isPhaseFilterOpen} onOpenChange={setIsPhaseFilterOpen}>
            <div>
              <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Filtrar por Fase</h3>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform mb-2", isPhaseFilterOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={phaseFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setPhaseFilter('all')}>
                    Todas as Fases ({ordersWithDetails.length})
                  </Button>
                  {ORDER_PHASES.map(phase => {
                    const count = ordersWithDetails.filter(o => getPhaseFromStatus(o.status) === phase.value).length;
                    if (count === 0) return null;
                    return (
                      <Button key={phase.value} variant={phaseFilter === phase.value ? 'default' : 'outline'} size="sm" onClick={() => setPhaseFilter(phase.value)}>
                        {phase.label} ({count})
                      </Button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('orderNumber')}>Nº Pedido{getSortIcon('orderNumber')}</TableHead>
              <TableHead className="min-w-[150px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client')}>Cliente{getSortIcon('client')}</TableHead>
              <TableHead className="min-w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('orderType')}>Tipo{getSortIcon('orderType')}</TableHead>
              <TableHead className="min-w-[90px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('itemsQuantity')}>Qtd. Itens{getSortIcon('itemsQuantity')}</TableHead>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>Status{getSortIcon('status')}</TableHead>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('issueDate')}>Data de Emissão{getSortIcon('issueDate')}</TableHead>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('deliveryDeadline')}>Data de Entrega{getSortIcon('deliveryDeadline')}</TableHead>
              <TableHead className="min-w-[90px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('daysOpen')}>Dias Aberto{getSortIcon('daysOpen')}</TableHead>
              <TableHead className="min-w-[120px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('deadline')}>Prazo{getSortIcon('deadline')}</TableHead>
              <TableHead className="min-w-[150px]">Entregas Parciais</TableHead>
              <TableHead className="min-w-[140px]">Origem Itens</TableHead>
              <TableHead className="min-w-[80px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('dateChanges')}>Mudanças{getSortIcon('dateChanges')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            ) : filteredOrders.map(order => {
              const daysOpen = calculateDaysOpen(order.createdDate);
              const daysUntil = calculateDaysUntilDeadline(order.deliveryDeadline);
              const deliveryInfo = getPartialDeliveryInfo(order.items || []);
              const deliveryPercentage = deliveryInfo.total > 0 ? Math.round(deliveryInfo.delivered / deliveryInfo.total * 100) : 0;
              const totalItemsQuantity = (order.items || []).reduce((sum, item) => sum + item.requestedQuantity, 0);
              const isCritical = daysUntil <= 2 && daysUntil >= 0;

              return (
                <TableRow key={order.id} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isCritical && "animate-pulse-critical")} onClick={() => onOrderClick(order)}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.client}</TableCell>
                  <TableCell>{getOrderTypeBadge(order.type)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-sm font-semibold">
                      <Package className="h-3 w-3 mr-1" />
                      {totalItemsQuantity}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {order.issueDate ? format(new Date(order.issueDate), 'dd-MM-yyyy') : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {order.deliveryDeadline ? format(new Date(order.deliveryDeadline), 'dd-MM-yyyy') : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">{daysOpen}d</Badge>
                  </TableCell>
                  <TableCell className="text-center">{getDeadlineBadge(daysUntil)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{deliveryInfo.delivered}/{deliveryInfo.total} itens ({deliveryPercentage}%)</div>
                      <Progress value={deliveryPercentage} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{getItemSourceBadges(order.items || [])}</TableCell>
                  <TableCell className="text-center">
                    {order.dateChangesCount && order.dateChangesCount > 0 ? (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">🔄 {order.dateChangesCount}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Exibir</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(size => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>por página</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({totalCount} pedidos)
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

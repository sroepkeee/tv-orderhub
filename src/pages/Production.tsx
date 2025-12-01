import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Factory, Package, ShoppingCart, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useProductionData } from "@/hooks/useProductionData";
import { useProductionExport } from "@/hooks/useProductionExport";
import { useProductionTrends } from "@/hooks/useProductionTrends";
import { 
  calculateProductionStats, 
  calculateCriticalItemsBreakdown, 
  calculatePendingStats 
} from "@/lib/metricsV2";
import { differenceInDays } from "date-fns";
import { ProductionFilters } from "@/components/metrics/ProductionFilters";
import { ProductionItemsTable } from "@/components/metrics/ProductionItemsTable";
import { ProductionFilters as Filters } from "@/types/production";
import { MetricCard } from "@/components/metrics/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { EditOrderDialog } from "@/components/EditOrderDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/components/Dashboard";

export default function Production() {
  const navigate = useNavigate();
  const { items, stats, isLoading, error, refetch } = useProductionData();
  const { exportToExcel } = useProductionExport();
  const { trends, loading: trendsLoading } = useProductionTrends();
  
  const [filters, setFilters] = useState<Filters>({
    orderNumber: '',
    itemStatus: 'all',
    warehouse: '',
    searchTerm: '',
    productionOrderNumber: '',
  });
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Extrair armazéns únicos
  const warehouses = useMemo(() => {
    return Array.from(new Set(items.map(item => item.warehouse))).sort();
  }, [items]);

  // Aplicar filtros
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filtro de número do pedido
      if (filters.orderNumber && !item.orderNumber.toLowerCase().includes(filters.orderNumber.toLowerCase())) {
        return false;
      }

      // Filtro de situação
      if (filters.itemStatus && filters.itemStatus !== 'all' && item.item_status !== filters.itemStatus) {
        return false;
      }

      // Filtro de armazém
      if (filters.warehouse && item.warehouse !== filters.warehouse) {
        return false;
      }

      // Filtro de número da OP
      if (filters.productionOrderNumber) {
        if (!item.production_order_number) {
          return false;
        }
        if (!item.production_order_number.toLowerCase().includes(filters.productionOrderNumber.toLowerCase())) {
          return false;
        }
      }

      // Filtro de busca (código ou descrição)
      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        return (
          item.itemCode.toLowerCase().includes(search) ||
          item.itemDescription.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [items, filters]);

  const handleExport = () => {
    if (filteredItems.length === 0) {
      toast.error('Nenhum item para exportar');
      return;
    }
    exportToExcel(filteredItems, stats);
  };

  const handleOrderClick = async (orderId: string) => {
    setLoadingOrder(true);
    try {
      // Buscar pedido completo com itens
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Montar objeto Order
      const order: Order = {
        id: orderData.id,
        orderNumber: orderData.order_number,
        client: orderData.customer_name,
        deliveryDeadline: orderData.delivery_date,
        status: orderData.status as any,
        priority: orderData.priority as any,
        type: orderData.order_type as any,
        deskTicket: orderData.order_number,
        item: '',
        description: '',
        quantity: 0,
        createdDate: orderData.created_at,
        delivery_address: orderData.delivery_address,
        issueDate: orderData.issue_date,
        items: itemsData.map(item => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: item.item_description,
          requestedQuantity: Number(item.requested_quantity),
          deliveredQuantity: Number(item.delivered_quantity),
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          unit: item.unit,
          item_status: item.item_status as any,
          item_source_type: item.item_source_type as any,
          production_estimated_date: item.production_estimated_date,
          is_imported: item.is_imported,
          import_lead_time_days: item.import_lead_time_days,
          sla_days: item.sla_days,
          sla_deadline: item.sla_deadline,
          current_phase: item.current_phase,
          phase_started_at: item.phase_started_at,
          received_status: item.received_status as any,
          userId: item.user_id,
          production_order_number: item.production_order_number,
        })),
        // Campos opcionais
        carrier_name: orderData.carrier_name,
        tracking_code: orderData.tracking_code,
        freight_value: orderData.freight_value ? Number(orderData.freight_value) : undefined,
        package_volumes: orderData.package_volumes,
        package_weight_kg: orderData.package_weight_kg ? Number(orderData.package_weight_kg) : undefined,
        package_height_m: orderData.package_height_m ? Number(orderData.package_height_m) : undefined,
        package_width_m: orderData.package_width_m ? Number(orderData.package_width_m) : undefined,
        package_length_m: orderData.package_length_m ? Number(orderData.package_length_m) : undefined,
        freight_type: orderData.freight_type,
        freight_modality: orderData.freight_modality,
        totvsOrderNumber: orderData.totvs_order_number,
        requires_firmware: orderData.requires_firmware,
        requires_image: orderData.requires_image,
        firmware_project_name: orderData.firmware_project_name,
        image_project_name: orderData.image_project_name,
      };

      setSelectedOrder(order);
      setShowEditDialog(true);
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      toast.error('Erro ao carregar pedido');
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleCloseDialog = () => {
    setShowEditDialog(false);
    setSelectedOrder(null);
    refetch(); // Atualizar lista após edição
  };

  const handleSaveOrder = () => {
    handleCloseDialog(); // Fecha e atualiza
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar dados de produção</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Factory className="h-8 w-8" />
              Controle de Produção
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão completa de todos os itens em produção e estoque
            </p>
          </div>
        </div>
        <Button onClick={handleExport} size="lg" className="gap-2">
          <Download className="h-5 w-5" />
          Exportar Excel
        </Button>
      </div>

      {/* Métricas */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-7 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-7 xl:grid-cols-7">
          <MetricCard
            title="Em Produção"
            value={stats.awaiting_production}
            icon={Factory}
            status="warning"
            percentage={(stats.awaiting_production / stats.total) * 100}
            additionalMetrics={(() => {
              const today = new Date();
              const productionItems = items.filter(i => i.item_status === 'awaiting_production');
              const lateItems = productionItems.filter(i => 
                differenceInDays(new Date(i.deliveryDate), today) < 0
              ).length;
              const onTimeItems = productionItems.length - lateItems;
              const avgDays = productionItems.length > 0
                ? Math.round(
                    productionItems.reduce((sum, i) => {
                      // ✨ USAR production_released_at quando disponível
                      const start = i.production_released_at 
                        ? new Date(i.production_released_at)
                        : new Date(i.created_at);
                      return sum + differenceInDays(today, start);
                    }, 0) / productionItems.length
                  )
                : 0;
              
              return [
                { label: "Atrasados", value: lateItems, highlight: lateItems > 0 },
                { label: "No prazo", value: onTimeItems },
                { label: "Tempo médio", value: `${avgDays}d` }
              ];
            })()}
            trend={trends.awaiting_production.change > 0 ? 'up' : trends.awaiting_production.change < 0 ? 'down' : 'neutral'}
            trendValue={`${trends.awaiting_production.change >= 0 ? '+' : ''}${trends.awaiting_production.change} itens`}
          />
          <MetricCard
            title="Pendentes"
            value={stats.pending}
            icon={Clock}
            percentage={(stats.pending / stats.total) * 100}
            additionalMetrics={(() => {
              const pendingItems = items.filter(i => i.item_status === 'pending');
              const today = new Date();
              const avgTime = pendingItems.length > 0
                ? Math.round(
                    pendingItems.reduce((sum, i) => {
                      // ✨ USAR production_released_at quando disponível
                      const start = i.production_released_at 
                        ? new Date(i.production_released_at)
                        : new Date(i.created_at);
                      return sum + differenceInDays(today, start);
                    }, 0) / pendingItems.length
                  )
                : 0;
              
              return [
                { label: "Aguard. análise", value: pendingItems.length },
                { label: "Tempo médio", value: `${avgTime}d` }
              ];
            })()}
            trend={trends.pending.change > 0 ? 'up' : trends.pending.change < 0 ? 'down' : 'neutral'}
            trendValue={`${trends.pending.change >= 0 ? '+' : ''}${trends.pending.change} itens`}
          />
          <MetricCard
            title="Solicitar Compra"
            value={stats.purchase_required}
            icon={ShoppingCart}
            status="warning"
            percentage={(stats.purchase_required / stats.total) * 100}
            trend={trends.purchase_required.change > 0 ? 'up' : trends.purchase_required.change < 0 ? 'down' : 'neutral'}
            trendValue={`${trends.purchase_required.change >= 0 ? '+' : ''}${trends.purchase_required.change} itens`}
          />
          <MetricCard
            title="Solicitado Compra"
            value={stats.purchase_requested}
            icon={ShoppingCart}
            percentage={(stats.purchase_requested / stats.total) * 100}
            additionalMetrics={[
              { label: "Em andamento", value: stats.purchase_requested }
            ]}
          />
          <MetricCard
            title="Concluídos"
            value={stats.completed}
            icon={CheckCircle}
            status="good"
            percentage={(stats.completed / (stats.total + stats.completed)) * 100}
            subtitle="Excluídos da lista"
          />
          <MetricCard
            title="Total de Itens"
            value={stats.total}
            icon={Package}
            subtitle="Itens ativos"
          />
          <MetricCard
            title="Itens Críticos"
            value={stats.critical}
            subtitle="Prazo ≤ 3 dias"
            icon={AlertTriangle}
            status={stats.critical > 0 ? "critical" : "good"}
            additionalMetrics={(() => {
              const today = new Date();
              const todayItems = items.filter(i => {
                const days = differenceInDays(new Date(i.deliveryDate), today);
                return days === 0 && i.item_status !== 'completed';
              }).length;
              const tomorrowItems = items.filter(i => {
                const days = differenceInDays(new Date(i.deliveryDate), today);
                return days === 1 && i.item_status !== 'completed';
              }).length;
              const days2to3 = items.filter(i => {
                const days = differenceInDays(new Date(i.deliveryDate), today);
                return days >= 2 && days <= 3 && i.item_status !== 'completed';
              }).length;
              
              return [
                { label: "Hoje", value: todayItems, highlight: todayItems > 0 },
                { label: "Amanhã", value: tomorrowItems },
                { label: "2-3 dias", value: days2to3 }
              ];
            })()}
            trend={trends.critical.change > 0 ? 'up' : trends.critical.change < 0 ? 'down' : 'neutral'}
            trendValue={`${trends.critical.change >= 0 ? '+' : ''}${trends.critical.change} itens`}
          />
        </div>
      )}

      {/* Filtros */}
      <ProductionFilters
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouses}
      />

      {/* Tabela */}
      <Card className="overflow-hidden">
        <CardHeader className="px-6">
          <CardTitle className="flex items-center justify-between">
            <span>
              Itens de Produção ({filteredItems.length})
            </span>
            {filters.itemStatus !== 'all' && (
              <span className="text-sm font-normal text-muted-foreground">
                Filtrando por situação
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <ProductionItemsTable
              items={filteredItems}
              onOrderClick={handleOrderClick}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      {selectedOrder && (
        <EditOrderDialog
          order={selectedOrder}
          open={showEditDialog}
          onOpenChange={handleCloseDialog}
          onSave={handleSaveOrder}
        />
      )}
    </div>
  );
}
